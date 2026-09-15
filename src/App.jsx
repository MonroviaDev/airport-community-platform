import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";
import {
  commuteMembers,
  demoProfiles,
  displayDays,
  displayTime,
  findMember,
  findVanpoolCluster,
  parseTripSummary,
} from "./lib/commutePlanner";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const destinations = [
  "Domestic Terminal",
  "International Terminal",
  "Delta TechOps",
  "Delta G.O.",
  "North Cargo Area",
  "South Cargo Area",
  "Rental Car Center",
  "Other Airport Area",
];

function readSessionObject(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function Header({ session }) {
  return (
    <header>
      <Link className="brand" to="/">
        <div className="brand-mark">A</div>
        <div>
          <strong>Airport Community</strong>
          <small>Connect • Commute • Community</small>
        </div>
      </Link>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/transportation">Transportation</Link>
        <Link to="/marketplace">Marketplace</Link>
        <Link to="/community">Resources</Link>
      </nav>

      <Link className="signin-button" to={session ? "/account" : "/register"}>
        {session ? "My Account" : "Sign In"}
      </Link>
    </header>
  );
}

function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">AIRPORT EMPLOYEE COMMUNITY</span>

          <h1>
            Work at the airport.
            <br />
            Connect beyond it.
          </h1>

          <p>
            Transportation, community resources, opportunities and practical
            solutions designed around the people who keep airports moving.
          </p>

          <div className="hero-buttons">
            <Link className="primary-button" to="/transportation">
              Find Transportation
            </Link>

            <Link className="secondary-button" to="/community">
              Explore Community
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">START HERE</span>
          <h2>What can we help you with?</h2>
        </div>

        <div className="card-grid">
          <FeatureCard
            icon="🚐"
            title="Transportation"
            text="Find rides, carpools, vanpools, transit and final-mile connections."
            link="/transportation"
            active
          />

          <FeatureCard
            icon="🛍️"
            title="Marketplace"
            text="Buy, sell and exchange items with the airport community."
            link="/marketplace"
          />

          <FeatureCard
            icon="👶"
            title="Childcare"
            text="Find childcare resources that understand airport schedules."
            link="/childcare"
          />

          <FeatureCard
            icon="🏠"
            title="Housing & Rentals"
            text="Explore rentals, roommates and housing opportunities."
            link="/housing"
          />

          <FeatureCard
            icon="💼"
            title="Jobs / Now Hiring"
            text="Discover opportunities throughout the airport community."
            link="/jobs"
          />

          <FeatureCard
            icon="⭐"
            title="Recognition / WOW"
            text="Recognize people who make the airport community better."
            link="/recognition"
          />

          <FeatureCard
            icon="🤝"
            title="Community Resources"
            text="Find useful programs and resources for airport employees."
            link="/community"
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, text, link, active }) {
  return (
    <Link className="feature-card" to={link}>
      <div className="feature-icon">{icon}</div>

      {active && <span className="available">AVAILABLE NOW</span>}

      <h3>{title}</h3>
      <p>{text}</p>

      <span className="learn-more">
        {active ? "Get started →" : "Learn more →"}
      </span>
    </Link>
  );
}

function Transportation() {
  return (
    <main className="page">
      <span className="eyebrow">TRANSPORTATION</span>
      <h1>How can we help with your commute?</h1>

      <p className="page-intro">
        Explore transportation options built around where you start, where you
        work at the airport and when you need to travel.
      </p>

      <div className="transport-grid">
        <Link className="transport-card featured" to="/plan-my-commute">
          <span className="transport-icon">🧭</span>
          <span className="available">AVAILABLE NOW</span>
          <h2>Plan My Commute</h2>
          <p>
            Compare MARTA, Xpress and shared transportation against your actual
            airport schedule.
          </p>
          <span>Compare my options →</span>
        </Link>

        <Link className="transport-card" to="/find-a-ride">
          <span className="transport-icon">🚗</span>
          <h2>I Need a Ride</h2>
          <p>
            Find potential drivers whose route and airport schedule may fit
            yours.
          </p>
          <span>Find ride matches →</span>
        </Link>

        <Link className="transport-card" to="/offer-a-ride">
          <span className="transport-icon">🚘</span>
          <h2>I Can Give a Ride</h2>
          <p>
            See whether airport workers may fit the commute you already make.
          </p>
          <span>See potential riders →</span>
        </Link>

        <Link className="transport-card" to="/plan-my-commute">
          <span className="transport-icon">🚐</span>
          <h2>Carpool & Vanpool Opportunities</h2>
          <p>
            Discover recurring transportation demand near your home and shift.
          </p>
          <span>Check my area →</span>
        </Link>
      </div>

      <div className="model-proof">
        <strong>Built from 6,521 modeled airport employee commutes</strong>
        <span>1,892 MARTA viable</span>
        <span>154 Xpress + MARTA viable</span>
        <span>121 vanpool opportunity clusters</span>
      </div>
    </main>
  );
}

/* =========================================================
   PLAN MY COMMUTE
   ========================================================= */

function PlanMyCommute() {
  const navigate = useNavigate();
  const [demoId, setDemoId] = useState("");
  const [showSamples, setShowSamples] = useState(false);
  const selectedDemo = commuteMembers.find(
    (member) => member.synthetic_id === demoId
  );

  function plan(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const criteria = {
      syntheticId: demoId,
      homeZip: form.get("homeZip"),
      destination: form.get("destination"),
      shiftStart: form.get("shiftStart"),
      shiftEnd: form.get("shiftEnd"),
      days: form.getAll("days"),
    };
    const member = findMember(criteria);

    sessionStorage.setItem(
      "airportCommutePlan",
      JSON.stringify({ criteria, memberId: member?.synthetic_id || null })
    );
    navigate("/commute-results");
  }

  const formProfile = selectedDemo || {};

  return (
    <main className="page planner-page">
      <div className="planner-heading">
        <span className="eyebrow">PLAN MY COMMUTE</span>
        <h1>Which options really work with your shift?</h1>
        <p>
          Compare complete round trips—not just nearby stops—using modeled
          MARTA, Xpress and vanpool availability.
        </p>
      </div>

      <div className="planner-layout">
        <form className="flow-card commute-form" key={demoId} onSubmit={plan}>
          <div className="form-row">
            <label>
              Home ZIP code
              <input
                name="homeZip"
                inputMode="numeric"
                pattern="[0-9]{5}"
                defaultValue={formProfile.home_zcta || ""}
                placeholder="Example: 30265"
                required
              />
            </label>

            <label>
              Airport work area
              <select
                name="destination"
                defaultValue={formProfile.airport_destination || ""}
                required
              >
                <option value="" disabled>Select work area</option>
                {destinations.map((destination) => (
                  <option key={destination}>{destination}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Shift starts
              <input
                name="shiftStart"
                type="time"
                defaultValue={formProfile.shift_start_time || ""}
                required
              />
            </label>
            <label>
              Shift ends
              <input
                name="shiftEnd"
                type="time"
                defaultValue={formProfile.shift_end_time || ""}
                required
              />
            </label>
          </div>

          <fieldset>
            <legend>Normal workdays</legend>
            <div className="day-grid">
              {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                <label className="day-choice" key={`${demoId}-${day}`}>
                  <input
                    name="days"
                    value={day}
                    type="checkbox"
                    defaultChecked={formProfile.work_days?.split("|").includes(day)}
                  />
                  <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="location-privacy compact-privacy">
            <strong>🔒 ZIP-level planning protects your privacy.</strong>
            <p>Exact addresses are not needed for this early commute analysis.</p>
          </div>

          <button className="continue-button" type="submit">
            Compare My Commute Options →
          </button>

          <div className="sample-commute">
            <button
              type="button"
              className="sample-toggle"
              onClick={() => setShowSamples((visible) => !visible)}
              aria-expanded={showSamples}
            >
              {showSamples ? "Hide sample commutes" : "Preview a sample commute"}
            </button>

            {showSamples && (
              <label className="demo-picker">
                Choose an example
                <select
                  value={demoId}
                  onChange={(event) => setDemoId(event.target.value)}
                >
                  <option value="">Select a sample commute</option>
                  {demoProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label}
                    </option>
                  ))}
                </select>
                {demoId && (
                  <small>
                    {demoProfiles.find((profile) => profile.id === demoId)?.detail}
                  </small>
                )}
              </label>
            )}
          </div>
        </form>

        <aside className="planner-aside">
          <span className="eyebrow">WHAT WE CHECK</span>
          <h2>A ride home matters, too.</h2>
          <div className="check-list">
            <span><b>1</b> Service before your shift</span>
            <span><b>2</b> Service after your shift</span>
            <span><b>3</b> Transfers and park-and-rides</span>
            <span><b>4</b> Nearby shared-commute demand</span>
          </div>
          <p>
            Planning results are estimates based on commute patterns. Actual
            service and shared-ride availability may change.
          </p>
        </aside>
      </div>
    </main>
  );
}

function CommuteResults() {
  const navigate = useNavigate();
  const savedPlan = readSessionObject("airportCommutePlan");

  const member = commuteMembers.find(
    (candidate) => candidate.synthetic_id === savedPlan.memberId
  );

  if (!member) {
    return (
      <main className="page flow-page">
        <div className="flow-card">
          <span className="eyebrow">PLAN MY COMMUTE</span>
          <h1>We need another starting point.</h1>
          <p className="flow-intro">
            We don't have enough planning coverage for that ZIP code yet.
            Return to the form and try a nearby ZIP code.
          </p>
          <button className="continue-button" onClick={() => navigate("/plan-my-commute")}>
            Return to Commute Details →
          </button>
        </div>
      </main>
    );
  }

  const vanpool = findVanpoolCluster(member);
  const martaInbound = parseTripSummary(member.marta_sample_inbound);
  const martaOutbound = parseTripSummary(member.marta_sample_outbound);
  const xpressInbound = parseTripSummary(member.xpress_marta_sample_inbound);
  const xpressOutbound = parseTripSummary(member.xpress_marta_sample_outbound);
  const martaComplete = member.marta_full_schedule === "true";
  const xpressComplete = member.xpress_marta_full_schedule === "true";
  const hasPartialTransit = member.transportation_recommendation.includes("partial");

  return (
    <main className="page commute-results-page">
      <Link className="back-link" to="/plan-my-commute">← Change commute</Link>

      <div className="commute-results-heading">
        <div>
          <span className="eyebrow">YOUR COMMUTE PLAN</span>
          <h1>{member.home_zcta} to {member.airport_destination}</h1>
          <p>
            {displayDays(member.work_days)} · {displayTime(member.shift_start_time)}–{displayTime(member.shift_end_time)}
          </p>
        </div>
        <div className={`recommendation-badge ${martaComplete || xpressComplete ? "viable" : "shared"}`}>
          <small>BEST FIT</small>
          <strong>
            {martaComplete ? "MARTA" : xpressComplete ? "Xpress + MARTA" : "Shared commute"}
          </strong>
        </div>
      </div>

      <div className="commute-option-list">
        <CommuteOption
          icon="🚆"
          title="MARTA rail"
          status={martaComplete ? "Complete round trip" : hasPartialTransit ? "Partial schedule fit" : "Schedule gap"}
          tone={martaComplete ? "good" : hasPartialTransit ? "partial" : "gap"}
          summary={`${member.nearest_marta_station} · ${member.distance_to_marta_miles} miles from home ZIP center`}
          inbound={martaInbound}
          outbound={martaOutbound}
          days={member.marta_round_trip_days}
          note={!martaComplete ? "Rail service does not cover every modeled workday in both directions." : "Modeled arrival and return trips work across the full schedule."}
        />

        <CommuteOption
          icon="🚌"
          title="Xpress + MARTA"
          status={xpressComplete ? "Complete round trip" : "Schedule gap"}
          tone={xpressComplete ? "good" : "gap"}
          summary={`${member.nearest_xpress_park_ride} · Route ${member.nearest_xpress_route_ids || "not available"} · ${member.distance_to_xpress_miles} miles`}
          inbound={xpressInbound}
          outbound={xpressOutbound}
          days={member.xpress_marta_round_trip_days}
          note={!xpressComplete ? "The commuter route or return schedule does not cover this full shift pattern." : "The park-and-ride connection completes both sides of the commute."}
        />

        <CommuteOption
          icon="🚐"
          title="Carpool / vanpool"
          status={vanpool ? "Demand found nearby" : "Interest can be collected"}
          tone={vanpool ? "shared" : "partial"}
          summary={vanpool ? `${vanpool.home_zctas.replaceAll("|", ", ")} · ${vanpool.start_window} start window` : `${member.home_county} · ${member.shift_family.replace("_", " ")} shift`}
          note={vanpool ? "This corridor shows strong potential for shared transportation. Actual availability depends on employee interest." : "No shared-ride group is available yet, but joining the interest list can help build one."}
          action="I'm Interested"
          actionLink="/transportation-interest"
        />
      </div>

      {(!martaComplete && !xpressComplete) && (
        <div className="gap-explanation">
          <div className="gap-icon">!</div>
          <div>
            <span className="eyebrow">WHY TRANSIT ISN'T THE TOP RESULT</span>
            <h2>The schedule leaves part of this commute uncovered.</h2>
            <p>
              Nearby transit alone is not enough: the model requires a workable
              trip before the shift and a workable trip home afterward. Shared
              transportation is prioritized when either side fails.
            </p>
          </div>
        </div>
      )}

      <div className="prototype-note">
        <strong>
          {savedPlan.criteria?.syntheticId ? "Sample commute: " : "Planning estimate: "}
        </strong>
        Results use modeled commute patterns, not live reservations or registered
        employee availability.
      </div>
    </main>
  );
}

function CommuteOption({ icon, title, status, tone, summary, inbound, outbound, days, note, action, actionLink }) {
  return (
    <section className={`commute-option ${tone}`}>
      <div className="commute-option-icon">{icon}</div>
      <div className="commute-option-main">
        <div className="commute-option-title">
          <div>
            <h2>{title}</h2>
            <p>{summary}</p>
          </div>
          <span className={`option-status ${tone}`}>{status}</span>
        </div>

        {(inbound || outbound) && (
          <div className="trip-pair">
            <TripLeg label="TO WORK" trip={inbound} />
            <TripLeg label="RIDE HOME" trip={outbound} />
          </div>
        )}

        <div className="commute-option-footer">
          <span>{days && Number(days) > 0 ? `✓ ${days} modeled round-trip day${days === "1" ? "" : "s"}` : note}</span>
          {action && <Link className="interest-button" to={actionLink}>{action} →</Link>}
        </div>
      </div>
    </section>
  );
}

function TripLeg({ label, trip }) {
  return (
    <div className={!trip ? "trip-leg unavailable" : "trip-leg"}>
      <small>{label}</small>
      {trip ? (
        <>
          <strong>{trip.timing}</strong>
          <span>{trip.modes}</span>
        </>
      ) : (
        <strong>No complete trip</strong>
      )}
    </div>
  );
}

function TransportationInterest() {
  const navigate = useNavigate();
  const savedPlan = readSessionObject("airportCommutePlan");
  const member = commuteMembers.find(
    (candidate) => candidate.synthetic_id === savedPlan.memberId
  );

  if (!member) {
    return (
      <main className="page flow-page">
        <div className="flow-card">
          <span className="eyebrow">SHARED TRANSPORTATION</span>
          <h1>Start with your commute.</h1>
          <p className="flow-intro">
            Plan your commute first so we can carry your ZIP code, work area,
            shift and workdays into the interest form.
          </p>
          <button
            className="continue-button"
            onClick={() => navigate("/plan-my-commute")}
          >
            Plan My Commute →
          </button>
        </div>
      </main>
    );
  }

  function saveInterest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const interest = {
      id: `interest-${Date.now()}`,
      createdAt: new Date().toISOString(),
      memberId: member.synthetic_id,
      homeZip: member.home_zcta,
      airportDestination: member.airport_destination,
      shiftStart: member.shift_start_time,
      shiftEnd: member.shift_end_time,
      workDays: member.work_days,
      rideRole: form.get("rideRole"),
      sharedMode: form.get("sharedMode"),
      frequency: form.get("frequency"),
      notificationPreference: form.get("notificationPreference"),
    };

    const interests = readLocalArray("airportTransportationInterests");
    localStorage.setItem(
      "airportTransportationInterests",
      JSON.stringify([...interests, interest])
    );
    sessionStorage.setItem(
      "latestTransportationInterest",
      JSON.stringify(interest)
    );
    navigate("/interest-confirmed");
  }

  return (
    <main className="page interest-page">
      <Link className="back-link" to="/commute-results">
        ← Back to commute options
      </Link>

      <div className="interest-layout">
        <form className="flow-card interest-form" onSubmit={saveInterest}>
          <span className="eyebrow">SHARED TRANSPORTATION INTEREST</span>
          <h1>How could a shared ride help?</h1>
          <p className="flow-intro">
            Tell us what would work for you. This does not commit you to a ride
            or share your exact address.
          </p>

          <fieldset>
            <legend>Which best describes you?</legend>
            <div className="interest-choice-grid three-up">
              <InterestChoice
                name="rideRole"
                value="rider"
                icon="🙋"
                title="I need a ride"
                text="Match me with drivers or a vanpool."
              />
              <InterestChoice
                name="rideRole"
                value="driver"
                icon="🚘"
                title="I can drive"
                text="I may have room for coworkers."
              />
              <InterestChoice
                name="rideRole"
                value="either"
                icon="↔️"
                title="Either works"
                text="Show me the best shared option."
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>What are you interested in?</legend>
            <div className="interest-choice-grid">
              <InterestChoice
                name="sharedMode"
                value="carpool"
                icon="🚗"
                title="Carpool"
                text="A small group sharing regular rides."
              />
              <InterestChoice
                name="sharedMode"
                value="vanpool"
                icon="🚐"
                title="Vanpool"
                text="A larger recurring group and vehicle."
              />
              <InterestChoice
                name="sharedMode"
                value="either"
                icon="✨"
                title="Either option"
                text="Use whichever group forms first."
              />
            </div>
          </fieldset>

          <div className="form-row">
            <label>
              How often would you use it?
              <select name="frequency" defaultValue="regular" required>
                <option value="regular">Most scheduled workdays</option>
                <option value="some-days">Some workdays</option>
                <option value="backup">Only as a backup ride</option>
              </select>
            </label>

            <label>
              Preferred notification
              <select
                name="notificationPreference"
                defaultValue="in-app"
                required
              >
                <option value="in-app">In-app notification</option>
                <option value="email">Email after account setup</option>
                <option value="text">Text after account setup</option>
              </select>
            </label>
          </div>

          <label className="interest-consent">
            <input type="checkbox" required />
            <span>
              I understand this records my interest only. It is not a confirmed
              ride, reservation or commitment to drive.
            </span>
          </label>

          <div className="prototype-storage-note">
            <strong>Prototype privacy:</strong> No email, phone number or exact
            address is collected. This demonstration saves the response only
            on this device until secure accounts are connected.
          </div>

          <button className="continue-button" type="submit">
            Join the Interest List →
          </button>
        </form>

        <aside className="interest-summary-card">
          <span className="eyebrow">YOUR COMMUTE</span>
          <h2>{member.home_zcta} to the airport</h2>
          <dl>
            <div>
              <dt>Work area</dt>
              <dd>{member.airport_destination}</dd>
            </div>
            <div>
              <dt>Shift</dt>
              <dd>
                {displayTime(member.shift_start_time)}–
                {displayTime(member.shift_end_time)}
              </dd>
            </div>
            <div>
              <dt>Workdays</dt>
              <dd>{displayDays(member.work_days)}</dd>
            </div>
          </dl>
          <Link to="/plan-my-commute">Change commute details</Link>
        </aside>
      </div>
    </main>
  );
}

function InterestChoice({ name, value, icon, title, text }) {
  return (
    <label className="interest-choice">
      <input type="radio" name={name} value={value} required />
      <span className="interest-choice-content">
        <b className="interest-choice-icon">{icon}</b>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );
}

function InterestConfirmed() {
  const interest = readSessionObject("latestTransportationInterest");

  if (!interest.homeZip) {
    return (
      <main className="page flow-page">
        <div className="flow-card">
          <span className="eyebrow">TRANSPORTATION INTEREST</span>
          <h1>No recent response found.</h1>
          <Link className="primary-button" to="/plan-my-commute">
            Plan My Commute
          </Link>
        </div>
      </main>
    );
  }

  const roleLabels = {
    rider: "Looking for a ride",
    driver: "May be able to drive",
    either: "Open to driving or riding",
  };
  const modeLabels = {
    carpool: "Carpool",
    vanpool: "Vanpool",
    either: "Carpool or vanpool",
  };

  return (
    <main className="page flow-page interest-success-page">
      <div className="success-card interest-success-card">
        <div className="success-icon">✓</div>
        <span className="eyebrow">INTEREST SAVED</span>
        <h1>You're helping a shared commute take shape.</h1>
        <p>
          Your prototype response is saved on this device. No driver has been
          contacted and no ride has been scheduled.
        </p>

        <div className="interest-confirmation-summary">
          <div>
            <small>COMMUTE</small>
            <strong>
              {interest.homeZip} → {interest.airportDestination}
            </strong>
          </div>
          <div>
            <small>ROLE</small>
            <strong>{roleLabels[interest.rideRole]}</strong>
          </div>
          <div>
            <small>INTEREST</small>
            <strong>{modeLabels[interest.sharedMode]}</strong>
          </div>
        </div>

        <div className="next-step-box">
          <strong>What happens later?</strong>
          <p>
            After secure accounts are connected, compatible employees can be
            notified when enough people express interest in the same corridor
            and shift.
          </p>
        </div>

        <div className="success-actions">
          <Link className="primary-button" to="/transportation">
            Transportation Home
          </Link>
          <Link className="secondary-button" to="/commute-results">
            View My Options
          </Link>
        </div>
      </div>
    </main>
  );
}

/* =========================================================
   RIDER FLOW
   ========================================================= */

function FindRide() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState("to-work");

  function search(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const searchData = {
      direction,
      location: form.get("location"),
      destination: form.get("destination"),
      arrive: form.get("arrive"),
      leave: form.get("leave"),
      days: form.getAll("days"),
    };

    sessionStorage.setItem(
      "airportCommunitySearch",
      JSON.stringify(searchData)
    );

    navigate("/transportation-preview");
  }

  return (
    <main className="page flow-page">
      <div className="flow-card wide-flow">
        <span className="eyebrow">FIND TRANSPORTATION</span>

        <h1>Let's find a better way to work.</h1>

        <p className="flow-intro">
          No account is required to preview transportation options.
        </p>

        <form onSubmit={search}>
          <fieldset>
            <legend>What transportation do you need?</legend>

            <div className="direction-grid">
              <button
                type="button"
                className={
                  direction === "to-work" ? "direction active" : "direction"
                }
                onClick={() => setDirection("to-work")}
              >
                <strong>✈️ TO WORK</strong>
                <span>Transportation to my airport job</span>
              </button>

              <button
                type="button"
                className={
                  direction === "home" ? "direction active" : "direction"
                }
                onClick={() => setDirection("home")}
              >
                <strong>🏠 RIDE HOME</strong>
                <span>Transportation home after work</span>
              </button>

              <button
                type="button"
                className={
                  direction === "both" ? "direction active" : "direction"
                }
                onClick={() => setDirection("both")}
              >
                <strong>↔️ BOTH</strong>
                <span>I need help in both directions</span>
              </button>
            </div>
          </fieldset>

          <label>
            Starting Area
            <input
              name="location"
              required
              placeholder="Enter an address or nearby intersection"
            />
          </label>

          <div className="location-privacy">
            <strong>🔒 Your location stays private.</strong>
            <p>
              A specific address gives you better transportation matches, but
              it is never displayed to other members. You may use a nearby
              intersection instead.
            </p>
          </div>

          <label>
            Airport Destination
            <select name="destination" required defaultValue="">
              <option value="" disabled>
                Select your airport work area
              </option>

              {destinations.map((destination) => (
                <option key={destination}>{destination}</option>
              ))}
            </select>
          </label>

          {(direction === "to-work" || direction === "both") && (
            <label>
              What time do you need to arrive at work?
              <input name="arrive" type="time" required />
            </label>
          )}

          {(direction === "home" || direction === "both") && (
            <label>
              What time does your shift end?
              <input name="leave" type="time" required />
            </label>
          )}

          <fieldset>
            <legend>Which days do you normally need transportation?</legend>

            <div className="day-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <label className="day-choice" key={day}>
                  <input name="days" value={day} type="checkbox" />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="continue-button" type="submit">
            Find My Transportation Options →
          </button>
        </form>
      </div>
    </main>
  );
}

function TransportationPreview() {
  const navigate = useNavigate();
  const search = readSessionObject("airportCommunitySearch");

  const directionLabel =
    search.direction === "home"
      ? "RIDE HOME"
      : search.direction === "both"
      ? "TO WORK + HOME"
      : "TO WORK";

  return (
    <main className="page preview-page">
      <div className="preview-heading">
        <span className="eyebrow">TRANSPORTATION PREVIEW</span>

        <h1>We found possibilities for your commute.</h1>

        <p>
          {search.location || "Your starting area"} →{" "}
          {search.destination || "Airport"}
        </p>
      </div>

      <div className="preview-summary">
        <div>
          <small>TRIP</small>
          <strong>{directionLabel}</strong>
        </div>

        {search.arrive && (
          <div>
            <small>ARRIVE BY</small>
            <strong>{search.arrive}</strong>
          </div>
        )}

        {search.leave && (
          <div>
            <small>SHIFT ENDS</small>
            <strong>{search.leave}</strong>
          </div>
        )}
      </div>

      <div className="preview-results">
        <div className="preview-result featured-result">
          <div className="result-icon">🚗</div>

          <div className="result-body">
            <span className="result-label">POTENTIAL RIDE MATCHES</span>
            <h2>3 community ride possibilities</h2>

            <p>
              We found people traveling through a compatible commute corridor
              near your schedule.
            </p>

            <div className="match-teaser">
              <strong>92% best potential match</strong>
              <span>
                Closest compatible route passes approximately 0.8 miles from
                your starting area.
              </span>
            </div>
          </div>
        </div>

        <div className="preview-result">
          <div className="result-icon">🚐</div>

          <div className="result-body">
            <span className="result-label">SHARED COMMUTE</span>
            <h2>Vanpool / carpool opportunity</h2>

            <p>
              Other airport workers travel from your general area during
              similar commute periods.
            </p>
          </div>
        </div>

        <div className="preview-result">
          <div className="result-icon">🚌</div>

          <div className="result-body">
            <span className="result-label">TRANSIT</span>
            <h2>Transit schedule analysis</h2>

            <p>
              We'll compare available public transportation and final-mile
              connections against your actual work schedule.
            </p>

            <span className="warning-pill">
              Example: early-shift service gap identified
            </span>
          </div>
        </div>
      </div>

      <div className="unlock-card">
        <div>
          <span className="eyebrow">YOUR MATCHES ARE READY</span>
          <h2>Want to see who's compatible?</h2>

          <p>
            Create a free account to reveal ride matches and see how their
            commute compares with yours.
          </p>
        </div>

        <button
          className="continue-button"
          onClick={() => navigate("/register")}
        >
          See My Ride Matches →
        </button>

        <span className="free-note">
          Free to join • Your exact starting location remains private
        </span>
      </div>

      <button
        className="edit-search"
        onClick={() => navigate("/find-a-ride")}
      >
        ← Change my search
      </button>
    </main>
  );
}

function Register({ session, authReady }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function sendMagicLink(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/register`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email and open the secure sign-in link.");
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="page flow-page">
        <div className="flow-card auth-flow-card">
          <span className="eyebrow">ACCOUNT SETUP</span>
          <h1>Secure sign-in is not configured.</h1>
          <p className="flow-intro">
            Add the Supabase project URL and publishable key to your local
            environment before testing employee accounts.
          </p>
        </div>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="page flow-page">
        <div className="flow-card auth-flow-card" aria-live="polite">
          <span className="eyebrow">SECURE ACCOUNT</span>
          <h1>Checking your sign-in…</h1>
        </div>
      </main>
    );
  }

  if (session) {
    return (
      <main className="page flow-page">
        <div className="flow-card auth-flow-card">
          <span className="eyebrow">SIGNED IN</span>
          <h1>Welcome to Airport Community.</h1>
          <div className="auth-success" role="status">
            <span>✓</span>
            <div>
              <strong>Your secure session is active.</strong>
              <small>{session.user.email}</small>
            </div>
          </div>
          <button className="continue-button" onClick={() => navigate("/profile")}>
            Continue to My Profile →
          </button>
          <button className="skip-button" onClick={() => navigate("/transportation")}>
            Go to Transportation
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page flow-page">
      <form className="flow-card auth-flow-card" onSubmit={sendMagicLink}>
        <span className="eyebrow">SECURE EMPLOYEE ACCOUNT</span>
        <h1>Sign in without a password.</h1>

        <p className="flow-intro">
          Enter your email and we’ll send you a secure, one-time sign-in link.
          New members can use the same process to create an account.
        </p>

        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <button className="email-button auth-submit" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending secure link…" : "Email Me a Sign-In Link"}
        </button>

        {message && (
          <div
            className={status === "error" ? "auth-message error" : "auth-message success"}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </div>
        )}

        <p className="privacy-note">
          We use your email for account access and service notifications. Your
          email is not shown to other members.
        </p>
      </form>
    </main>
  );
}

function Account({ session, authReady, onSignOut }) {
  if (!authReady) {
    return (
      <main className="page flow-page">
        <div className="flow-card auth-flow-card">
          <h1>Loading your account…</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page flow-page">
        <div className="flow-card auth-flow-card">
          <span className="eyebrow">MY ACCOUNT</span>
          <h1>You’re signed out.</h1>
          <p className="flow-intro">Sign in to access your member profile.</p>
          <Link className="primary-button" to="/register">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page flow-page">
      <div className="flow-card auth-flow-card">
        <span className="eyebrow">MY ACCOUNT</span>
        <h1>Your secure account</h1>
        <div className="account-detail">
          <small>EMAIL</small>
          <strong>{session.user.email}</strong>
        </div>
        <p className="privacy-note">
          Your session stays active on this device until you sign out.
        </p>
        <button className="secondary-button auth-signout" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </main>
  );
}

function Profile() {
  const navigate = useNavigate();

  function finish(event) {
    event.preventDefault();
    navigate("/ride-matches");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card" onSubmit={finish}>
        <span className="eyebrow">ONE LAST STEP</span>

        <h1>Create your community profile.</h1>

        <p className="flow-intro">
          We already saved your commute. We only need a few details about you.
        </p>

        <label>
          First name
          <input required placeholder="First name" />
        </label>

        <label>
          How do you currently get to work most often?
          <select required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option>Drive myself</option>
            <option>Ride with someone</option>
            <option>MARTA / public transit</option>
            <option>Carpool / vanpool</option>
            <option>Uber / Lyft / taxi</option>
            <option>Walk / bike</option>
            <option>Other</option>
          </select>
        </label>

        <label>
          For shared rides, I am primarily:
          <select required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option>A rider looking for a driver</option>
            <option>A driver who can offer rides</option>
            <option>Open to driving or riding</option>
          </select>
        </label>

        <button className="continue-button" type="submit">
          Reveal My Matches →
        </button>
      </form>
    </main>
  );
}

function RideMatches() {
  return (
    <main className="page">
      <span className="eyebrow">YOUR RIDE MATCHES</span>

      <h1>These commutes may work with yours.</h1>

      <p className="page-intro">
        Your starting address is never displayed. Matches are based on route,
        schedule and airport-destination compatibility.
      </p>

      <div className="match-list">
        <MatchCard
          initials="TM"
          name="Tasha M."
          role="DRIVER — OFFERING RIDES"
          current="Drives herself to work"
          looking="1–2 regular riders"
          score="92%"
          direction="TO WORK"
          proximity="Route passes about 0.8 mi from your starting area"
          airport="Domestic Terminal"
          time="Usually arrives 5:25 AM"
          days="Mon • Tue • Thu • Fri"
        />

        <MatchCard
          initials="JR"
          name="James R."
          role="DRIVER OR RIDER"
          current="Usually drives to work"
          looking="Open to sharing the commute"
          score="87%"
          direction="TO WORK"
          proximity="Route passes about 1.4 mi from your starting area"
          airport="Delta G.O."
          time="Usually arrives 5:30 AM"
          days="Mon • Wed • Thu • Fri"
        />

        <MatchCard
          initials="AK"
          name="Angela K."
          role="RIDER — LOOKING FOR A DRIVER"
          current="Currently gets rides from family"
          looking="Regular transportation"
          score="81%"
          direction="RIDE HOME"
          proximity="Destination is near your homebound route"
          airport="Domestic Terminal"
          time="Shift ends around 2:45 PM"
          days="Tue • Wed • Thu • Fri"
        />
      </div>
    </main>
  );
}

function MatchCard(props) {
  return (
    <div className="match-card v2-match">
      <div className="avatar">{props.initials}</div>

      <div className="match-main">
        <div className="match-title">
          <h2>{props.name}</h2>
          <span className="role-badge">{props.role}</span>
        </div>

        <div className="score-row">
          <strong>
            {props.score} {props.direction}
          </strong>
        </div>

        <div className="commute-status">
          <p>
            <strong>Current commute:</strong> {props.current}
          </p>
          <p>
            <strong>Looking for:</strong> {props.looking}
          </p>
        </div>

        <div className="match-facts">
          <span>📍 {props.proximity}</span>
          <span>✈️ {props.airport}</span>
          <span>🕒 {props.time}</span>
          <span>📅 {props.days}</span>
        </div>
      </div>

      <Link className="primary-button" to="/match/tasha">
        View Match
      </Link>
    </div>
  );
}

function MatchProfile() {
  const navigate = useNavigate();

  return (
    <main className="page match-profile-page">
      <Link className="back-link" to="/ride-matches">
        ← Back to matches
      </Link>

      <section className="driver-profile-card">
        <div className="driver-profile-top">
          <div className="avatar large-avatar">TM</div>

          <div className="driver-identity">
            <span className="role-badge">DRIVER — OFFERING RIDES</span>
            <h1>Tasha M.</h1>
            <p className="rating">★ 4.9 · 42 shared trips</p>
          </div>
        </div>

        <div className="compatibility-heading">
          <span className="eyebrow">COMMUTE COMPATIBILITY</span>
          <h2>How Tasha's commute compares with yours</h2>
        </div>

        <div className="direction-match-grid">
          <div className="direction-match excellent">
            <div className="direction-match-header">
              <span>✈️ TO WORK</span>
              <strong>92%</strong>
            </div>

            <h3>Excellent match</h3>

            <ul>
              <li>Route passes about 0.8 mi from your starting area</li>
              <li>Tasha normally arrives around 5:25 AM</li>
              <li>Your airport destinations are compatible</li>
              <li>4 common commute days</li>
            </ul>
          </div>

          <div className="direction-match unavailable">
            <div className="direction-match-header">
              <span>🏠 RIDE HOME</span>
              <strong>—</strong>
            </div>

            <h3>Not currently available</h3>

            <p>
              Tasha's afternoon schedule doesn't currently match your ride-home
              request.
            </p>
          </div>
        </div>

        <div className="driver-details-grid">
          <div>
            <small>CURRENT COMMUTE</small>
            <strong>Drives herself to work</strong>
          </div>

          <div>
            <small>LOOKING FOR</small>
            <strong>1–2 regular riders</strong>
          </div>

          <div>
            <small>SEATS AVAILABLE</small>
            <strong>2</strong>
          </div>

          <div>
            <small>RIDE TYPE</small>
            <strong>Regular or occasional</strong>
          </div>

          <div>
            <small>AIRPORT DESTINATION</small>
            <strong>Domestic Terminal</strong>
          </div>

          <div>
            <small>TYPICAL ARRIVAL</small>
            <strong>5:25 AM</strong>
          </div>
        </div>

        <div className="route-privacy-box">
          <strong>🔒 Location privacy</strong>
          <p>
            Tasha can see only your approximate route compatibility at this
            stage. Your exact starting address is not shown.
          </p>
        </div>

        <button
          className="continue-button"
          onClick={() => navigate("/request-ride")}
        >
          Request a Ride with Tasha →
        </button>
      </section>
    </main>
  );
}

function RequestRide() {
  const navigate = useNavigate();
  const [requestDirection, setRequestDirection] = useState("to-work");

  function continueRequest(event) {
    event.preventDefault();

    sessionStorage.setItem("rideRequestDirection", requestDirection);
    navigate("/message-tasha");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card wide-flow" onSubmit={continueRequest}>
        <span className="eyebrow">REQUEST A RIDE</span>
        <h1>What would you like to ask Tasha?</h1>

        <p className="flow-intro">
          Tasha currently matches your morning commute. Choose the ride you're
          requesting before sending her a message.
        </p>

        <fieldset>
          <legend>Ride requested</legend>

          <div className="request-direction-grid">
            <button
              type="button"
              className={
                requestDirection === "to-work"
                  ? "request-direction selected"
                  : "request-direction"
              }
              onClick={() => setRequestDirection("to-work")}
            >
              <strong>✈️ TO WORK</strong>
              <span>92% compatible</span>
            </button>

            <button
              type="button"
              className="request-direction disabled"
              disabled
            >
              <strong>🏠 RIDE HOME</strong>
              <span>Not currently compatible</span>
            </button>
          </div>
        </fieldset>

        <label>
          When would you like to start?
          <input type="date" required />
        </label>

        <label>
          How often are you looking for this ride?
          <select defaultValue="regular">
            <option value="regular">Regular recurring ride</option>
            <option value="occasional">Occasional rides</option>
            <option value="one-time">One-time ride</option>
          </select>
        </label>

        <div className="route-privacy-box">
          <strong>Your exact address stays private.</strong>
          <p>
            If Tasha accepts your request, you can both agree on an appropriate
            pickup location before the ride.
          </p>
        </div>

        <button className="continue-button" type="submit">
          Continue to Message →
        </button>
      </form>
    </main>
  );
}

function VoiceTextInput() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useState({ current: null })[0];

  function startDictation() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice dictation is not supported by this browser. You can still type your message."
      );
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = text;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let newFinalText = finalTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const words = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          newFinalText +=
            (newFinalText && !newFinalText.endsWith(" ") ? " " : "") + words;

          finalTranscript = newFinalText;
        } else {
          interimTranscript += words;
        }
      }

      setText(
        finalTranscript +
          (interimTranscript
            ? `${finalTranscript ? " " : ""}${interimTranscript}`
            : "")
      );
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition:", event.error);

      if (event.error !== "no-speech") {
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopDictation() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setListening(false);
  }

  return (
    <div className="voice-message-box">
      <textarea
        rows="7"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Hi Tasha, I'm looking for a regular ride to work and it looks like our schedules may be compatible..."
        required
      />

      <div className="voice-controls">
        {!listening ? (
          <button type="button" className="voice-start" onClick={startDictation}>
            🎤 Start Dictation
          </button>
        ) : (
          <>
            <div className="listening-indicator">
              <span></span>
              Listening…
            </div>

            <button type="button" className="voice-stop" onClick={stopDictation}>
              ■ Stop Dictation
            </button>
          </>
        )}
      </div>

      <small>
        Dictated text appears above so you can review or edit it before sending.
      </small>
    </div>
  );
}

function MessageTasha() {
  const navigate = useNavigate();

  function sendMessage(event) {
    event.preventDefault();
    navigate("/request-sent");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card wide-flow" onSubmit={sendMessage}>
        <span className="eyebrow">MESSAGE TASHA</span>
        <h1>Introduce yourself.</h1>

        <p className="flow-intro">
          Tell Tasha a little about the ride you're looking for. You can type or
          use voice dictation.
        </p>

        <div className="message-recipient">
          <div className="avatar">TM</div>

          <div>
            <strong>Tasha M.</strong>
            <span>🚗 Driver · Offering rides to work</span>
          </div>
        </div>

        <VoiceTextInput />

        <div className="message-safety">
          <strong>Before you send</strong>
          <p>
            Don't include your exact home address, phone number or other
            sensitive information in your first message. You can arrange a
            pickup location after you both choose to connect.
          </p>
        </div>

        <button className="continue-button" type="submit">
          Send Ride Request →
        </button>
      </form>
    </main>
  );
}

function RequestSent() {
  return (
    <main className="page flow-page">
      <div className="success-card">
        <div className="success-icon">✓</div>

        <span className="eyebrow">RIDE REQUEST SENT</span>

        <h1>Tasha has your request.</h1>

        <p>
          She'll be able to review your commute compatibility and message. Your
          exact starting address has not been shared.
        </p>

        <div className="request-summary">
          <div>
            <small>REQUEST</small>
            <strong>✈️ Ride TO WORK</strong>
          </div>

          <div>
            <small>COMPATIBILITY</small>
            <strong>92%</strong>
          </div>
        </div>

        <div className="success-actions">
          <Link className="primary-button" to="/ride-matches">
            View Other Matches
          </Link>

          <Link className="secondary-button" to="/">
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}

/* =========================================================
   DRIVER / OFFER-A-RIDE FLOW
   ========================================================= */

function OfferRide() {
  const navigate = useNavigate();
  const [direction, setDirection] = useState("to-work");

  function search(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const offerData = {
      direction,
      location: form.get("location"),
      destination: form.get("destination"),
      arrive: form.get("arrive"),
      leave: form.get("leave"),
      days: form.getAll("days"),
      seats: form.get("seats"),
      frequency: form.get("frequency"),
      deviation: form.get("deviation"),
    };

    sessionStorage.setItem(
      "airportCommunityRideOffer",
      JSON.stringify(offerData)
    );

    navigate("/rider-preview");
  }

  return (
    <main className="page flow-page">
      <div className="flow-card wide-flow">
        <span className="eyebrow">OFFER A RIDE</span>

        <h1>Could someone share your commute?</h1>

        <p className="flow-intro">
          Tell us about the trip you're already making. We'll look for airport
          workers whose transportation needs may fit your route and schedule.
        </p>

        <form onSubmit={search}>
          <fieldset>
            <legend>When could you offer a ride?</legend>

            <div className="direction-grid">
              <button
                type="button"
                className={
                  direction === "to-work" ? "direction active" : "direction"
                }
                onClick={() => setDirection("to-work")}
              >
                <strong>✈️ TO WORK</strong>
                <span>I can take someone to the airport</span>
              </button>

              <button
                type="button"
                className={
                  direction === "home" ? "direction active" : "direction"
                }
                onClick={() => setDirection("home")}
              >
                <strong>🏠 RIDE HOME</strong>
                <span>I can take someone home after work</span>
              </button>

              <button
                type="button"
                className={
                  direction === "both" ? "direction active" : "direction"
                }
                onClick={() => setDirection("both")}
              >
                <strong>↔️ BOTH</strong>
                <span>I may be able to help both ways</span>
              </button>
            </div>
          </fieldset>

          <label>
            Starting Area
            <input
              name="location"
              required
              placeholder="Enter an address or nearby intersection"
            />
          </label>

          <div className="location-privacy">
            <strong>🔒 Your location stays private.</strong>
            <p>
              A specific starting point improves route matching but is never
              displayed to other members. You can use a nearby intersection
              instead.
            </p>
          </div>

          <label>
            Airport Destination
            <select name="destination" required defaultValue="">
              <option value="" disabled>
                Select your airport work area
              </option>

              {destinations.map((destination) => (
                <option key={destination}>{destination}</option>
              ))}
            </select>
          </label>

          {(direction === "to-work" || direction === "both") && (
            <label>
              What time do you normally arrive at work?
              <input name="arrive" type="time" required />
            </label>
          )}

          {(direction === "home" || direction === "both") && (
            <label>
              What time do you normally leave work?
              <input name="leave" type="time" required />
            </label>
          )}

          <fieldset>
            <legend>Which days do you normally make this commute?</legend>

            <div className="day-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <label className="day-choice" key={day}>
                  <input name="days" value={day} type="checkbox" />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            How many passenger seats could you normally offer?
            <select name="seats" required defaultValue="">
              <option value="" disabled>
                Select seats available
              </option>
              <option value="1">1 seat</option>
              <option value="2">2 seats</option>
              <option value="3">3 seats</option>
              <option value="4+">4 or more seats</option>
            </select>
          </label>

          <label>
            What type of ride sharing interests you?
            <select name="frequency" required defaultValue="">
              <option value="" disabled>
                Select one
              </option>
              <option value="regular">Regular riders</option>
              <option value="occasional">Occasional riders</option>
              <option value="either">Regular or occasional</option>
            </select>
          </label>

          <fieldset>
            <legend>
              How far would you consider going off your normal route?
            </legend>

            <p className="field-help">
              This helps us avoid showing riders who would make your commute
              impractical.
            </p>

            <div className="deviation-grid">
              <label className="deviation-choice">
                <input
                  type="radio"
                  name="deviation"
                  value="route-only"
                  required
                />
                <strong>Stay on my route</strong>
                <span>Very little deviation</span>
              </label>

              <label className="deviation-choice">
                <input type="radio" name="deviation" value="5-minutes" />
                <strong>Up to 5 minutes</strong>
                <span>Small detour</span>
              </label>

              <label className="deviation-choice">
                <input type="radio" name="deviation" value="10-minutes" />
                <strong>Up to 10 minutes</strong>
                <span>Moderate detour</span>
              </label>

              <label className="deviation-choice">
                <input type="radio" name="deviation" value="flexible" />
                <strong>I'm flexible</strong>
                <span>Show me good matches</span>
              </label>
            </div>
          </fieldset>

          <button className="continue-button" type="submit">
            Find Potential Riders →
          </button>
        </form>
      </div>
    </main>
  );
}

function RiderPreview() {
  const navigate = useNavigate();
  const offer = readSessionObject("airportCommunityRideOffer");

  const directionLabel =
    offer.direction === "home"
      ? "RIDE HOME"
      : offer.direction === "both"
      ? "TO WORK + HOME"
      : "TO WORK";

  return (
    <main className="page preview-page">
      <div className="preview-heading">
        <span className="eyebrow">RIDER PREVIEW</span>

        <h1>Your commute may be useful to other airport workers.</h1>

        <p>
          {offer.location || "Your starting area"} →{" "}
          {offer.destination || "Airport"}
        </p>
      </div>

      <div className="preview-summary">
        <div>
          <small>RIDES OFFERED</small>
          <strong>{directionLabel}</strong>
        </div>

        {offer.seats && (
          <div>
            <small>AVAILABLE</small>
            <strong>
              {offer.seats} {offer.seats === "1" ? "seat" : "seats"}
            </strong>
          </div>
        )}

        {offer.arrive && (
          <div>
            <small>ARRIVE</small>
            <strong>{offer.arrive}</strong>
          </div>
        )}

        {offer.leave && (
          <div>
            <small>LEAVE</small>
            <strong>{offer.leave}</strong>
          </div>
        )}
      </div>

      <div className="driver-opportunity-card">
        <div className="opportunity-number">4</div>

        <div>
          <span className="result-label">POTENTIAL RIDERS</span>
          <h2>Airport workers may fit your commute.</h2>

          <p>
            We found transportation needs that overlap with your general route,
            airport destination and schedule.
          </p>
        </div>
      </div>

      <div className="rider-teaser-grid">
        <div className="rider-teaser">
          <div className="blur-avatar">?</div>

          <div>
            <span className="result-label">RIDER</span>
            <h3>Potential match</h3>
            <strong className="compatibility-score">94% TO WORK</strong>

            <p>
              Pickup area is close to your normal commute corridor.
            </p>

            <div className="teaser-facts">
              <span>✈️ Domestic Terminal</span>
              <span>🕒 Needs to arrive around 5:30 AM</span>
              <span>📅 4 common days</span>
            </div>
          </div>
        </div>

        <div className="rider-teaser">
          <div className="blur-avatar">?</div>

          <div>
            <span className="result-label">RIDER</span>
            <h3>Potential match</h3>
            <strong className="compatibility-score">88% TO WORK</strong>

            <p>
              Similar airport schedule with a manageable potential detour.
            </p>

            <div className="teaser-facts">
              <span>✈️ Domestic Terminal</span>
              <span>🕒 Needs to arrive around 5:20 AM</span>
              <span>📅 3 common days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="driver-value-box">
        <span className="eyebrow">YOUR NORMAL COMMUTE</span>

        <h2>You don't have to become a taxi driver.</h2>

        <p>
          The goal is to identify people who already fit the trip you're
          making. You control which riders you consider, how often you share a
          ride and how much deviation you're willing to accept.
        </p>
      </div>

      <div className="unlock-card">
        <div>
          <span className="eyebrow">SEE YOUR POTENTIAL RIDERS</span>

          <h2>Want to see who's compatible?</h2>

          <p>
            Create a free account to reveal potential riders and compare their
            transportation needs with your normal commute.
          </p>
        </div>

        <button
          className="continue-button"
          onClick={() => navigate("/driver-register")}
        >
          See Potential Riders →
        </button>

        <span className="free-note">
          Free to join • Your exact starting location remains private
        </span>
      </div>

      <button
        className="edit-search"
        onClick={() => navigate("/offer-a-ride")}
      >
        ← Change my commute
      </button>
    </main>
  );
}

function DriverRegister() {
  const navigate = useNavigate();

  return (
    <main className="page flow-page">
      <div className="flow-card">
        <span className="eyebrow">REVEAL POTENTIAL RIDERS</span>

        <h1>Create your free account.</h1>

        <p className="flow-intro">
          Your commute and ride preferences are already saved. You won't have
          to enter them again.
        </p>

        <button
          className="social-button"
          onClick={() => navigate("/driver-profile")}
        >
          <span>G</span> Continue with Google
        </button>

        <button
          className="social-button"
          onClick={() => navigate("/driver-profile")}
        >
          <span>f</span> Continue with Facebook
        </button>

        <button
          className="social-button"
          onClick={() => navigate("/driver-profile")}
        >
          <span>●</span> Continue with Apple
        </button>

        <div className="divider">
          <span>or</span>
        </div>

        <button
          className="email-button"
          onClick={() => navigate("/driver-profile")}
        >
          Sign up with email
        </button>

        <p className="privacy-note">
          Demo registration only. Social sign-in will be connected later.
        </p>
      </div>
    </main>
  );
}
function VoiceProfileInput() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useState({ current: null })[0];

  function startDictation() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice dictation is not supported by this browser. You can still type your response."
      );
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = text;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let newFinalText = finalTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const words = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          newFinalText +=
            (newFinalText && !newFinalText.endsWith(" ") ? " " : "") +
            words;

          finalTranscript = newFinalText;
        } else {
          interimTranscript += words;
        }
      }

      setText(
        finalTranscript +
          (interimTranscript
            ? `${finalTranscript ? " " : ""}${interimTranscript}`
            : "")
      );
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition:", event.error);

      if (event.error !== "no-speech") {
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopDictation() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setListening(false);
  }

  return (
    <div className="voice-profile-input">
      <textarea
        rows="4"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Example: I leave on time, usually listen to music, and prefer regular riders."
      />

      <div className="voice-controls">
        {!listening ? (
          <button
            type="button"
            className="voice-start"
            onClick={startDictation}
          >
            🎤 Start Dictation
          </button>
        ) : (
          <>
            <div className="listening-indicator">
              <span></span>
              Listening…
            </div>

            <button
              type="button"
              className="voice-stop"
              onClick={stopDictation}
            >
              ■ Stop Dictation
            </button>
          </>
        )}
      </div>

      <small>
        Review or edit your dictated text before continuing.
      </small>
    </div>
  );
}
function DriverProfileSetup() {
  const navigate = useNavigate();

  function finish(event) {
    event.preventDefault();
    navigate("/potential-riders");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card" onSubmit={finish}>
        <span className="eyebrow">ONE LAST STEP</span>

        <h1>Create your community profile.</h1>

        <p className="flow-intro">
          We already have your commute, schedule and ride preferences.
        </p>

        <label>
          First name
          <input required placeholder="First name" />
        </label>

        <label>
          What best describes you?
          <select required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option>I normally drive and can offer rides</option>
            <option>I can sometimes drive or ride</option>
          </select>
        </label>

        <div className="profile-voice-field">
  <label>
    Anything riders should know about your ride?{" "}
    <span className="optional">(optional)</span>
  </label>

  <VoiceProfileInput />
</div>

        <div className="route-privacy-box">
          <strong>Keep it general.</strong>

          <p>
            Don't enter a license plate, exact home address or other sensitive
            personal information here.
          </p>
        </div>

        <button className="continue-button" type="submit">
          Reveal Potential Riders →
        </button>
      </form>
    </main>
  );
}

function PotentialRiders() {
  return (
    <main className="page">
      <span className="eyebrow">POTENTIAL RIDERS</span>

      <h1>These transportation needs may fit your commute.</h1>

      <p className="page-intro">
        Exact home addresses aren't shown. Compatibility is based on route,
        schedule, airport destination and common commute days.
      </p>

      <div className="match-list">
        <RiderMatchCard
          id="angela"
          initials="AM"
          name="Angela M."
          score="94%"
          direction="TO WORK"
          current="Gets rides from family"
          looking="Regular weekday ride"
          proximity="Pickup area is near your normal route"
          airport="Domestic Terminal"
          time="Needs to arrive around 5:30 AM"
          days="Mon • Tue • Thu • Fri"
        />

        <RiderMatchCard
          id="derrick"
          initials="DB"
          name="Derrick B."
          score="88%"
          direction="TO WORK"
          current="Uses rideshare apps"
          looking="Regular or occasional rides"
          proximity="Small potential deviation from your commute"
          airport="Domestic Terminal"
          time="Needs to arrive around 5:20 AM"
          days="Mon • Wed • Thu"
        />

        <RiderMatchCard
          id="sheila"
          initials="SC"
          name="Sheila C."
          score="82%"
          direction="TO WORK"
          current="Shares rides when available"
          looking="Occasional transportation"
          proximity="General starting area overlaps your corridor"
          airport="International Terminal"
          time="Needs to arrive around 5:30 AM"
          days="Tue • Thu • Fri"
        />
      </div>
    </main>
  );
}
function RiderProfile() {
  const navigate = useNavigate();

  return (
    <main className="page match-profile-page">
      <Link className="back-link" to="/potential-riders">
        ← Back to potential riders
      </Link>

      <section className="driver-profile-card">
        <div className="driver-profile-top">
          <div className="avatar large-avatar">AM</div>

          <div className="driver-identity">
            <span className="role-badge">
              RIDER — NEEDS TRANSPORTATION
            </span>

            <h1>Angela M.</h1>
          </div>
        </div>

        <div className="compatibility-heading">
          <span className="eyebrow">COMMUTE COMPATIBILITY</span>

          <h2>How Angela's transportation needs fit your commute</h2>
        </div>

        <div className="direction-match-grid">
          <div className="direction-match excellent">
            <div className="direction-match-header">
              <span>✈️ TO WORK</span>
              <strong>94%</strong>
            </div>

            <h3>Excellent match</h3>

            <ul>
              <li>Angela's pickup area is near your normal route</li>
              <li>She needs to arrive around 5:30 AM</li>
              <li>She works in the Domestic Terminal area</li>
              <li>You have 4 common commute days</li>
            </ul>
          </div>

          <div className="direction-match unavailable">
            <div className="direction-match-header">
              <span>🏠 RIDE HOME</span>
              <strong>—</strong>
            </div>

            <h3>Not currently requested</h3>

            <p>
              Angela is currently looking for transportation to work.
            </p>
          </div>
        </div>

        <div className="driver-details-grid">
          <div>
            <small>CURRENT COMMUTE</small>
            <strong>Gets rides from family</strong>
          </div>

          <div>
            <small>LOOKING FOR</small>
            <strong>Regular weekday ride</strong>
          </div>

          <div>
            <small>AIRPORT DESTINATION</small>
            <strong>Domestic Terminal</strong>
          </div>

          <div>
            <small>NEEDS TO ARRIVE</small>
            <strong>About 5:30 AM</strong>
          </div>

          <div>
            <small>COMMON DAYS</small>
            <strong>Mon · Tue · Thu · Fri</strong>
          </div>

          <div>
            <small>ROUTE IMPACT</small>
            <strong>Small potential detour</strong>
          </div>
        </div>

        <div className="route-privacy-box">
          <strong>🔒 Location privacy</strong>

          <p>
            Angela's exact starting address isn't shown. You can see only
            enough location information to evaluate whether her pickup area
            could reasonably fit your commute.
          </p>
        </div>

        <button
  className="continue-button"
  onClick={() => navigate("/offer-ride/angela")}
>
  Offer Angela a Ride →
</button>
      </section>
    </main>
  );
}
function RiderMatchCard(props) {
  return (
    <div className="match-card v2-match">
      <div className="avatar">{props.initials}</div>

      <div className="match-main">
        <div className="match-title">
          <h2>{props.name}</h2>
          <span className="role-badge">RIDER — NEEDS TRANSPORTATION</span>
        </div>

        <div className="score-row">
          <strong>
            {props.score} {props.direction}
          </strong>
        </div>

        <div className="commute-status">
          <p>
            <strong>Current commute:</strong> {props.current}
          </p>

          <p>
            <strong>Looking for:</strong> {props.looking}
          </p>
        </div>

        <div className="match-facts">
          <span>📍 {props.proximity}</span>
          <span>✈️ {props.airport}</span>
          <span>🕒 {props.time}</span>
          <span>📅 {props.days}</span>
        </div>
      </div>

      <Link className="primary-button" to={`/rider/${props.id}`}>
  View Rider
</Link>
    </div>
  );
}

/* =========================================================
   COMING SOON MODULES
   ========================================================= */
function OfferRideToRider() {
  const navigate = useNavigate();
  const [offerType, setOfferType] = useState("regular");

  function continueOffer(event) {
    event.preventDefault();

    sessionStorage.setItem(
      "driverRideOffer",
      JSON.stringify({
        rider: "Angela M.",
        direction: "to-work",
        offerType,
      })
    );

    navigate("/message-angela");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card wide-flow" onSubmit={continueOffer}>
        <span className="eyebrow">OFFER A RIDE</span>

        <h1>Offer Angela a ride.</h1>

        <p className="flow-intro">
          Your morning commute is highly compatible with Angela's
          transportation needs.
        </p>

        <div className="message-recipient">
          <div className="avatar">AM</div>

          <div>
            <strong>Angela M.</strong>
            <span>Rider · Looking for transportation to work</span>
          </div>
        </div>

        <fieldset>
          <legend>Ride you can offer</legend>

          <div className="request-direction-grid">
            <button
              type="button"
              className="request-direction selected"
            >
              <strong>✈️ TO WORK</strong>
              <span>94% compatible</span>
            </button>

            <button
              type="button"
              className="request-direction disabled"
              disabled
            >
              <strong>🏠 RIDE HOME</strong>
              <span>Angela isn't currently requesting this trip</span>
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>What type of ride are you offering?</legend>

          <div className="offer-type-grid">
            <button
              type="button"
              className={
                offerType === "regular"
                  ? "offer-type selected"
                  : "offer-type"
              }
              onClick={() => setOfferType("regular")}
            >
              <strong>Regular</strong>
              <span>Recurring commute</span>
            </button>

            <button
              type="button"
              className={
                offerType === "occasional"
                  ? "offer-type selected"
                  : "offer-type"
              }
              onClick={() => setOfferType("occasional")}
            >
              <strong>Occasional</strong>
              <span>Some workdays</span>
            </button>

            <button
              type="button"
              className={
                offerType === "one-time"
                  ? "offer-type selected"
                  : "offer-type"
              }
              onClick={() => setOfferType("one-time")}
            >
              <strong>One time</strong>
              <span>A specific trip</span>
            </button>
          </div>
        </fieldset>

        <div className="route-privacy-box">
          <strong>🔒 No pickup location is required yet.</strong>

          <p>
            Angela's exact starting address remains private. If you both choose
            to connect, you can agree on a convenient pickup point together.
          </p>
        </div>

        <button className="continue-button" type="submit">
          Continue to Message →
        </button>
      </form>
    </main>
  );
}

function MessageAngela() {
  const navigate = useNavigate();

  function sendOffer(event) {
    event.preventDefault();
    navigate("/offer-sent");
  }

  return (
    <main className="page flow-page">
      <form className="flow-card wide-flow" onSubmit={sendOffer}>
        <span className="eyebrow">MESSAGE ANGELA</span>

        <h1>Introduce yourself.</h1>

        <p className="flow-intro">
          Let Angela know you're interested in sharing your existing commute.
          You can type or use voice dictation.
        </p>

        <div className="message-recipient">
          <div className="avatar">AM</div>

          <div>
            <strong>Angela M.</strong>
            <span>✈️ 94% TO WORK compatibility</span>
          </div>
        </div>

        <VoiceTextInput />

        <div className="message-safety">
          <strong>Before you send</strong>

          <p>
            Keep your first message general. Don't include your exact home
            address, phone number, license plate or other sensitive
            information. Pickup details can be discussed after you both choose
            to connect.
          </p>
        </div>

        <button className="continue-button" type="submit">
          Send Ride Offer →
        </button>
      </form>
    </main>
  );
}

function OfferSent() {
  return (
    <main className="page flow-page">
      <div className="success-card">
        <div className="success-icon">✓</div>

        <span className="eyebrow">RIDE OFFER SENT</span>

        <h1>Angela has your offer.</h1>

        <p>
          She'll be able to review your commute compatibility and your message
          before deciding whether she'd like to connect.
        </p>

        <div className="request-summary">
          <div>
            <small>OFFER</small>
            <strong>✈️ Ride TO WORK</strong>
          </div>

          <div>
            <small>COMPATIBILITY</small>
            <strong>94%</strong>
          </div>

          <div>
            <small>STATUS</small>
            <strong>Awaiting response</strong>
          </div>
        </div>

        <div className="route-privacy-box">
          <strong>Location privacy maintained</strong>

          <p>
            Angela has not received your exact starting address, and you have
            not received hers.
          </p>
        </div>

        <div className="success-actions">
          <Link className="primary-button" to="/potential-riders">
            View Other Riders
          </Link>

          <Link className="secondary-button" to="/">
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function ComingSoon({ title, description }) {
  return (
    <main className="page coming-soon">
      <span className="eyebrow">AIRPORT COMMUNITY</span>
      <h1>{title}</h1>

      <p className="page-intro">{description}</p>

      <div className="coming-box">
        <span>COMING SOON</span>
        <h2>We're building this for the airport community.</h2>

        <p>
          Transportation is launching first. This section will become part of
          the same connected community platform.
        </p>

        <Link className="primary-button" to="/">
          Return Home
        </Link>
      </div>
    </main>
  );
}

/* =========================================================
   ROUTES
   ========================================================= */

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <BrowserRouter>
      <Header session={session} />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/transportation" element={<Transportation />} />
        <Route path="/plan-my-commute" element={<PlanMyCommute />} />
        <Route path="/commute-results" element={<CommuteResults />} />
        <Route
          path="/transportation-interest"
          element={<TransportationInterest />}
        />
        <Route path="/interest-confirmed" element={<InterestConfirmed />} />

        {/* Rider flow */}
        <Route path="/find-a-ride" element={<FindRide />} />
        <Route
          path="/transportation-preview"
          element={<TransportationPreview />}
        />
        <Route
          path="/register"
          element={<Register session={session} authReady={authReady} />}
        />
        <Route
          path="/account"
          element={
            <Account
              session={session}
              authReady={authReady}
              onSignOut={signOut}
            />
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ride-matches" element={<RideMatches />} />
        <Route path="/match/:id" element={<MatchProfile />} />
        <Route path="/request-ride" element={<RequestRide />} />
        <Route path="/message-tasha" element={<MessageTasha />} />
        <Route path="/request-sent" element={<RequestSent />} />

        {/* Driver flow */}
        <Route path="/offer-a-ride" element={<OfferRide />} />
        <Route path="/rider-preview" element={<RiderPreview />} />
        <Route path="/driver-register" element={<DriverRegister />} />
        <Route path="/driver-profile" element={<DriverProfileSetup />} />
        <Route path="/potential-riders" element={<PotentialRiders />} />
        <Route path="/rider/:id" element={<RiderProfile />} />
        <Route path="/offer-ride/:id" element={<OfferRideToRider />} />
        <Route path="/message-angela" element={<MessageAngela />} />
        <Route path="/offer-sent" element={<OfferSent />} />

        {/* Community modules */}
        <Route
          path="/marketplace"
          element={
            <ComingSoon
              title="Marketplace / Classifieds"
              description="A trusted marketplace for the airport employee community."
            />
          }
        />

        <Route
          path="/childcare"
          element={
            <ComingSoon
              title="Childcare"
              description="Childcare resources designed around airport work schedules."
            />
          }
        />

        <Route
          path="/housing"
          element={
            <ComingSoon
              title="Housing & Rentals"
              description="Housing, rentals and roommate opportunities connected to the airport community."
            />
          }
        />

        <Route
          path="/jobs"
          element={
            <ComingSoon
              title="Jobs / Now Hiring"
              description="Employment opportunities throughout the airport community."
            />
          }
        />

        <Route
          path="/recognition"
          element={
            <ComingSoon
              title="Recognition / WOW"
              description="Community-powered recognition for exceptional service."
            />
          }
        />

        <Route
          path="/community"
          element={
            <ComingSoon
              title="Community Resources"
              description="Programs, services and useful resources for airport employees."
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
