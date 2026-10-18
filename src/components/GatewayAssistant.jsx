import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./GatewayAssistant.css";

const intents = [
  { label: "Find a ride", icon: "🚐", path: "/plan-my-commute", reply: "Let's explore your commute options. Gateway can compare modeled transit, carpools and vanpools. Enter your shift and starting area in Plan My Commute." },
  { label: "Skip the Bus", icon: "🚆", path: "/skip-the-bus", reply: "You can combine MARTA with a shared last-mile ride. Start with your station and arrival window." },
  { label: "Marketplace", icon: "🛍️", path: "/marketplace", reply: "Browse listings from the Gateway community, or create your own listing." },
  { label: "Find a job", icon: "💼", path: "/jobs", reply: "Explore the Gateway jobs section." },
  { label: "Housing", icon: "🏠", path: "/housing", reply: "Explore housing and roommate resources." },
  { label: "Childcare", icon: "👶", path: "/childcare", reply: "Explore childcare resources for airport schedules." },
  { label: "Community help", icon: "🤝", path: "/community", reply: "Find community services and resources." },
];
function interpret(text) {
  const t = text.toLowerCase();
  if (/marta|station|last.mile|skip.*bus/.test(t)) return intents[1];
  if (/ride|carpool|vanpool|commute|transport|shift|bus|work|airport/.test(t)) return intents[0];
  if (/sell|buy|market|listing|furniture|phone/.test(t)) return intents[2];
  if (/job|hiring|employment/.test(t)) return intents[3];
  if (/house|housing|rent|roommate|apartment/.test(t)) return intents[4];
  if (/child|daycare|babysit/.test(t)) return intents[5];
  if (/resource|help|community|service/.test(t)) return intents[6];
  return null;
}
export default function GatewayAssistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: "assistant", text: "Welcome to Gateway. What can I help you with today?" }]);
  const [draft, setDraft] = useState("");
  const [nextPath, setNextPath] = useState(null);
  function respond(text, intent = interpret(text)) {
    const reply = intent ? intent.reply : "I can help you find transportation, marketplace listings, jobs, housing, childcare, and community resources. Try one of the options below.";
    setMessages(old => [...old, { role: "user", text }, { role: "assistant", text: reply }]);
    setNextPath(intent?.path || null);
  }
  function submit(e) {
    e.preventDefault();
    const text = draft.trim().slice(0, 500);
    if (!text) return;
    respond(text);
    setDraft("");
  }
  return (
    <main className="gateway-assistant-page">
      <div className="gateway-assistant-shell">
        <div className="gateway-assistant-heading">
          <span className="eyebrow">YOUR AIRPORT COMMUNITY</span>
          <h1>How can Gateway help?</h1>
          <p>Find your way to work, connect with coworkers, and explore your airport community.</p>
        </div>
        <section className="gateway-assistant-panel" aria-label="Gateway guided assistant">
          <div className="gateway-assistant-status"><span className="gateway-assistant-sparkle" aria-hidden="true">✦</span><div><strong>Gateway Assistant</strong><small>Guided help · No AI subscription required</small></div></div>
          <div className="gateway-assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, i) => <div key={i} className={`gateway-assistant-bubble ${message.role}`}>{message.text}</div>)}
            {nextPath && <div className="gateway-assistant-action"><button type="button" onClick={() => navigate(nextPath)}>Open this feature →</button></div>}
          </div>
          <div className="gateway-assistant-quick" aria-label="Popular requests">
            {intents.map(item => <button type="button" key={item.label} onClick={() => respond(item.label, item)}><span aria-hidden="true">{item.icon}</span> {item.label}</button>)}
          </div>
          <form className="gateway-assistant-compose" onSubmit={submit}>
            <label className="gateway-assistant-sr" htmlFor="gateway-request">Ask Gateway</label>
            <input id="gateway-request" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder="What do you need help with?" />
            <button type="submit" disabled={!draft.trim()} aria-label="Send request">↑</button>
          </form>
          <p className="gateway-assistant-disclaimer">Guided assistant preview. Replies are based on predefined topics, not generative AI. Commute results may include synthetic demonstration data, not real available rides.</p>
        </section>
        <div className="gateway-assistant-links"><span>Prefer to browse?</span> <Link to="/transportation">Transportation</Link><Link to="/marketplace">Marketplace</Link><Link to="/community">Resources</Link></div>
      </div>
    </main>
  );
}
