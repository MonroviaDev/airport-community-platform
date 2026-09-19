import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Marketplace.css";

const seedListings = [
  { id:"m1", title:"Samsung 43-inch Smart TV", price:120, category:"Electronics", area:"Domestic Terminal", seller:"Marcus J.", age:"2h", icon:"📺", description:"Works well. Upgraded to a larger TV. Can meet before or after shift." },
  { id:"m2", title:"Airport-approved lunch cooler", price:15, category:"For Sale", area:"Airport Station", seller:"Tanya R.", age:"5h", icon:"🧊", description:"Clean insulated cooler, good for long shifts." },
  { id:"m3", title:"Twin bed frame", price:0, category:"Free", area:"College Park Station", seller:"David M.", age:"1d", icon:"🛏️", description:"Free metal twin frame. Pickup or airport meetup by arrangement." },
  { id:"m4", title:"Noise-canceling headphones", price:45, category:"Electronics", area:"International Terminal", seller:"Keisha B.", age:"1d", icon:"🎧", description:"Bluetooth headphones in good condition with charging cable." },
  { id:"m5", title:"Looking for small microwave", price:null, category:"Wanted", area:"Domestic Terminal", seller:"Andre S.", age:"2d", icon:"🔎", description:"Looking for an inexpensive countertop microwave in working condition." },
  { id:"m6", title:"Uniform-friendly black work shoes", price:25, category:"Clothing / Uniforms", area:"Employee Lot", seller:"Monica L.", age:"2d", icon:"👟", description:"Men's size 10, lightly worn, slip-resistant." }
];

const categories=["All","For Sale","Free","Wanted","Electronics","Furniture / Home","Clothing / Uniforms","Auto","Tickets / Other"];
const meetupAreas=["Domestic Terminal","International Terminal","Airport Station","College Park Station","Employee Lot","Other"];

function readMine(){
  try { return JSON.parse(localStorage.getItem("airportMarketplaceListings") || "[]"); }
  catch { return []; }
}

export default function Marketplace({ session }){
  const [mine,setMine]=useState(readMine);
 useEffect(()=>{if(session&&sessionStorage.getItem("airportPendingAction")==="post-marketplace"){sessionStorage.removeItem("airportPendingAction");setPosting(true)}},[session]);
 function startPosting(){if(session){setPosting(true);return}sessionStorage.setItem("airportAuthReturnTo","/marketplace");sessionStorage.setItem("airportPendingAction","post-marketplace");window.location.assign("/register")}
  const [category,setCategory]=useState("All");
  const [query,setQuery]=useState("");
  const [posting,setPosting]=useState(false);
  const [selected,setSelected]=useState(null);

  const listings=useMemo(()=>[...mine,...seedListings].filter(item=>{
    const categoryMatch=category==="All" || item.category===category || (category==="For Sale" && !["Free","Wanted"].includes(item.category));
    const q=query.trim().toLowerCase();
    return categoryMatch && (!q || [item.title,item.category,item.area,item.description].join(" ").toLowerCase().includes(q));
  }),[mine,category,query]);

  function submitListing(e){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const priceType=f.get("priceType");
    const item={
      id:"mine-"+Date.now(), title:f.get("title"), category:f.get("category"),
      price:priceType==="free"?0:priceType==="wanted"?null:Number(f.get("price")||0),
      area:f.get("area"), seller:"My listing", age:"Just now", icon:"📦",
      description:f.get("description")
    };
    const next=[item,...mine];
    localStorage.setItem("airportMarketplaceListings",JSON.stringify(next));
    setMine(next); setPosting(false); setSelected(item);
  }

  function markSold(id){
    const next=mine.filter(x=>x.id!==id);
    localStorage.setItem("airportMarketplaceListings",JSON.stringify(next));
    setMine(next); setSelected(null);
  }

  if(posting) return <main className="page market-page"><button className="market-back" onClick={()=>setPosting(false)}>← Back to Marketplace</button><form className="market-form" onSubmit={submitListing}><span className="eyebrow">POST AN ITEM</span><h1>Create a classified listing.</h1><p>Keep exchanges simple. Choose an airport meetup point instead of sharing a home address.</p><label>Listing title<input name="title" required maxLength="90" placeholder="What are you selling or looking for?" /></label><div className="market-two"><label>Category<select name="category" required defaultValue="For Sale">{categories.filter(x=>x!=="All").map(x=><option key={x}>{x}</option>)}</select></label><label>Listing type<select name="priceType" defaultValue="price"><option value="price">Priced item</option><option value="free">Free</option><option value="wanted">Wanted</option></select></label></div><label>Price<input name="price" type="number" min="0" step="1" placeholder="0" /></label><label>Description<textarea name="description" rows="5" required maxLength="700" placeholder="Condition, size, useful details, and when you can meet." /></label><label>Preferred airport meetup<select name="area" required defaultValue="Domestic Terminal">{meetupAreas.map(x=><option key={x}>{x}</option>)}</select></label><div className="market-safety"><strong>🔒 Keep personal details private.</strong><span>Do not post a home address, phone number, badge number, or other sensitive information.</span></div><button className="continue-button" type="submit">Publish Listing →</button></form></main>;

  if(selected) return <main className="page market-page"><button className="market-back" onClick={()=>setSelected(null)}>← Back to Marketplace</button><section className="market-detail"><div className="market-detail-image">{selected.icon}</div><div><span className="market-category">{selected.category}</span><h1>{selected.title}</h1><div className="market-price">{selected.price===0?"FREE":selected.price==null?"WANTED":`$${selected.price}`}</div><p>{selected.description}</p><div className="market-meta"><span>👤 {selected.seller}</span><span>📍 {selected.area}</span><span>🕒 {selected.age}</span></div><div className="market-meetup"><strong>Airport meetup preferred</strong><p>Arrange the exact time and public meetup point through the platform. Home addresses do not need to be exchanged.</p></div>{selected.id.startsWith("mine-")?<button className="secondary-button" onClick={()=>markSold(selected.id)}>Mark Sold / Remove</button>:<button className="continue-button" onClick={()=>alert("Messaging will connect to the shared community chat component next.")}>Message Seller →</button>}</div></section></main>;

  return <main className="page market-page"><section className="market-hero"><div><span className="eyebrow">MARKETPLACE / CLASSIFIEDS</span><h1>Buy, sell and exchange with the airport community.</h1><p>Local listings designed around airport schedules and convenient employee meetup points.</p></div><button className="primary-button" onClick={startPosting}>＋ Post an Item</button></section><div className="market-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search listings, categories or meetup areas…" /></div><div className="market-categories">{categories.map(x=><button key={x} className={category===x?"active":""} onClick={()=>setCategory(x)}>{x}</button>)}</div>{mine.length>0&&<div className="market-mine"><strong>My Listings</strong><span>{mine.length} active</span></div>}<div className="market-grid">{listings.map(item=><button className="listing-card" key={item.id} onClick={()=>setSelected(item)}><div className="listing-image">{item.icon}</div><div className="listing-body"><span className="market-category">{item.category}</span><h2>{item.title}</h2><strong className="listing-price">{item.price===0?"FREE":item.price==null?"WANTED":`$${item.price}`}</strong><div className="listing-meta"><span>📍 {item.area}</span><span>{item.seller} · {item.age}</span></div></div></button>)}</div>{!listings.length&&<div className="market-empty">No listings match this search yet.</div>}<div className="market-trust"><strong>Safer airport-community exchanges</strong><span>Use public meetup locations, keep early conversations in-platform, and report suspicious listings.</span></div></main>;
}
