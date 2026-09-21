import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadConversation, markConversationRead, sendConversationMessage } from "../lib/communityMessaging";
import "./Conversation.css";

export default function Conversation({ session, authReady }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data,setData]=useState(null);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);

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
    <div className="conversation-header"><Link to="/marketplace">← Marketplace</Link><div><span className="eyebrow">PRIVATE MESSAGE</span><h1>Marketplace conversation</h1></div></div>
    <section className="conversation-thread">
      {!data.messages.length&&<div className="conversation-empty"><strong>Start the conversation.</strong><span>Ask about availability, condition, or a convenient airport meetup time. Keep personal details private.</span></div>}
      {data.messages.map(message=><div key={message.id} className={message.sender_id===data.userId?"message mine":"message theirs"}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}
    </section>
    <form className="conversation-compose" onSubmit={submit}><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength="2000" rows="3" placeholder="Write a message…" /><button className="continue-button" disabled={sending||!body.trim()}>{sending?"Sending…":"Send →"}</button></form>
    <p className="conversation-safety">Keep early conversations in the platform. Do not share badge numbers, passwords, financial account information, or other sensitive information.</p>
  </main>;
}
