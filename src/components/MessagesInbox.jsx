import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadConversationInbox } from "../lib/communityMessaging";
import "./MessagesInbox.css";

function relativeTime(value){
  if(!value) return "No messages yet";
  const diff=Date.now()-new Date(value).getTime();
  const min=Math.max(1,Math.floor(diff/60000));
  if(min<60) return `${min}m`;
  const hr=Math.floor(min/60);
  if(hr<24) return `${hr}h`;
  const day=Math.floor(hr/24);
  return day<7?`${day}d`:new Date(value).toLocaleDateString();
}

export default function MessagesInbox({session,authReady}){
  const navigate=useNavigate();
  const [rows,setRows]=useState([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!authReady) return;
    if(!session){
      sessionStorage.setItem("airportAuthReturnTo","/messages");
      navigate("/register",{replace:true});
      return;
    }
    loadConversationInbox().then(data=>{setRows(data);setError("");}).catch(err=>setError(err.message||"Unable to load messages.")).finally(()=>setLoading(false));
  },[session,authReady,navigate]);

  return <main className="page inbox-page">
    <span className="eyebrow">MESSAGES</span>
    <h1>Your conversations.</h1>
    <p className="page-intro">Private conversations from Marketplace and, as we connect them, other Airport Community services.</p>
    {loading&&<div className="inbox-state">Loading messages…</div>}
    {error&&<div className="inbox-state">{error}</div>}
    {!loading&&!error&&!rows.length&&<div className="inbox-state"><strong>No conversations yet.</strong><span>When you message another community member, the conversation will appear here.</span><Link to="/marketplace">Browse Marketplace →</Link></div>}
    <section className="inbox-list">
      {rows.map(row=><Link className={row.unread_count>0?"inbox-row unread":"inbox-row"} key={row.conversation_id} to={`/messages/${row.conversation_id}`}>
        <div className="inbox-avatar">{(row.other_display_name||"A").trim().charAt(0).toUpperCase()}</div>
        <div className="inbox-copy"><div className="inbox-top"><strong>{row.other_display_name}</strong><time>{relativeTime(row.last_message_at)}</time></div><span className="inbox-context">{row.context_title}</span><p>{row.last_message||"Conversation started — send the first message."}</p></div>
        {row.unread_count>0&&<span className="inbox-badge">{row.unread_count}</span>}
      </Link>)}
    </section>
  </main>;
}
