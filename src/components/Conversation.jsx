import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadConversation, markConversationRead, sendConversationMessage } from "../lib/communityMessaging";
import { supabase } from "../lib/supabase";
import "./Conversation.css";

export default function Conversation({ session, authReady }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data,setData]=useState(null);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);
  const [otherTyping,setOtherTyping]=useState(false);

  useEffect(()=>{
    if(!authReady) return;
    if(!session){
      sessionStorage.setItem("airportAuthReturnTo", `/messages/${id}`);
      navigate("/register",{replace:true});
      return;
    }
    loadConversation(id).then(async result=>{
      setData(result);
      try {
        await markConversationRead(id);
        window.dispatchEvent(new Event("airport-messages-read"));
      } catch (readError) {
        console.error("Unable to mark conversation read", readError);
      }
    }).catch(err=>setError(err.message||"Unable to load this conversation."));
  },[id,session,authReady,navigate]);

  useEffect(()=>{
    if(!session || !id || !supabase) return undefined;

    const channel = supabase
      .channel(`conversation:${id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if(payload?.userId !== session.user.id) setOtherTyping(Boolean(payload?.typing));
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async payload => {
          const incoming = payload.new;
          setData(current => {
            if(!current || current.messages.some(message => message.id === incoming.id)) return current;
            return { ...current, messages: [...current.messages, incoming] };
          });

          if(incoming.sender_id !== session.user.id){
            try {
              await markConversationRead(id);
              window.dispatchEvent(new Event("airport-messages-read"));
            } catch (readError) {
              console.error("Unable to mark incoming message read", readError);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },[id,session]);

  function handleBodyChange(e){
    const value=e.target.value;
    setBody(value);
    if(!supabase || !session) return;
    const typingChannel=supabase.channel(`typing-send:${id}`);
    typingChannel.subscribe(status=>{
      if(status==="SUBSCRIBED"){
        typingChannel.send({type:"broadcast",event:"typing",payload:{userId:session.user.id,typing:Boolean(value.trim())}}).finally(()=>supabase.removeChannel(typingChannel));
      }
    });
  }

  async function submit(e){
    e.preventDefault();
    if(!body.trim()) return;
    try{
      setSending(true);
      const message=await sendConversationMessage(id,body);
      setData(current=>({...current,messages:[...current.messages,message]}));
      setBody("");
    }catch(err){setError(err.message||"Unable to send message.")}
    finally{setSending(false)}
  }

  if(!authReady||(!data&&!error)) return <main className="page conversation-page"><div className="conversation-state">Loading conversation…</div></main>;
  if(error) return <main className="page conversation-page"><div className="conversation-state"><h1>Conversation unavailable</h1><p>{error}</p><Link to="/marketplace">Return to Marketplace</Link></div></main>;

  return <main className="page conversation-page">
    <div className="conversation-header"><Link to={data.conversation.context_type==="marketplace"?"/marketplace":"/messages"}>← {data.conversation.context_type==="marketplace"?"Marketplace":"Messages"}</Link><div className="conversation-context">{data.context?.context_image_url&&<img src={data.context.context_image_url} alt="" />}<div><span className="eyebrow">PRIVATE MESSAGE</span><h1>{data.context?.other_display_name||"Airport Community Member"}</h1>{data.context?.context_title&&<p><strong>{data.context.context_title}</strong>{data.context.context_price!=null&&<> · {Number(data.context.context_price)===0?"Free":`${Number(data.context.context_price).toLocaleString()}`}</>}</p>}</div></div></div>
    <section className="conversation-thread">
      {!data.messages.length&&<div className="conversation-empty"><strong>Start the conversation.</strong><span>Ask about availability, condition, or a convenient airport meetup time. Keep personal details private.</span></div>}
      {data.messages.map(message=><div key={message.id} className={message.sender_id===data.userId?"message mine":"message theirs"}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}{message.sender_id===data.userId&&<> · {message.read_at?"Read":"Sent"}</>}</small></div>)}{otherTyping&&<div className="typing-row"><span>{data.context?.other_display_name||"Member"} is typing</span><i></i><i></i><i></i></div>}
    </section>
    <form className="conversation-compose" onSubmit={submit}><textarea value={body} onChange={handleBodyChange} maxLength="2000" rows="3" placeholder="Write a message…" /><button className="continue-button" disabled={sending||!body.trim()}>{sending?"Sending…":"Send →"}</button></form>
    <p className="conversation-safety">Keep early conversations in the platform. Do not share badge numbers, passwords, financial account information, or other sensitive information.</p>
  </main>;
}
