import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";

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

function Header() {
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

      <Link className="signin-button" to="/register">
        Sign In
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
        <Link className="transport-card featured" to="/find-a-ride">
          <span className="transport-icon">🚗</span>
          <h2>I Need a Ride</h2>
          <p>
            See potential ride matches and other transportation options before
            creating an account.
          </p>
          <span>Find my options →</span>
        </Link>

        <div className="transport-card">
          <span className="transport-icon">🚘</span>
          <h2>I Can Give a Ride</h2>
          <p>
            Share your existing commute with other airport community members.
          </p>
          <span>Coming next</span>
        </div>

        <div className="transport-card">
          <span className="transport-icon">🚌</span>
          <h2>Transit & Final Mile</h2>
          <p>
            Explore commuter transit, MARTA, hubs and final-mile connections.
          </p>
          <span>Coming next</span>
        </div>

        <div className="transport-card">
          <span className="transport-icon">🚐</span>
          <h2>Carpool & Vanpool</h2>
          <p>
            Explore recurring transportation groups based on airport schedules.
          </p>
          <span>Coming next</span>
        </div>
      </div>
    </main>
  );
}

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
                className={direction === "to-work" ? "direction active" : "direction"}
                onClick={() => setDirection("to-work")}
              >
                <strong>✈️ TO WORK</strong>
                <span>Transportation to my airport job</span>
              </button>

              <button
                type="button"
                className={direction === "home" ? "direction active" : "direction"}
                onClick={() => setDirection("home")}
              >
                <strong>🏠 RIDE HOME</strong>
                <span>Transportation home after work</span>
              </button>

              <button
                type="button"
                className={direction === "both" ? "direction active" : "direction"}
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

  let search = {};

  try {
    search = JSON.parse(
      sessionStorage.getItem("airportCommunitySearch") || "{}"
    );
  } catch {
    search = {};
  }

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

function Register() {
  const navigate = useNavigate();

  return (
    <main className="page flow-page">
      <div className="flow-card">
        <span className="eyebrow">UNLOCK YOUR MATCHES</span>
        <h1>Create your free account.</h1>

        <p className="flow-intro">
          Your commute search is saved. You won't have to enter it again.
        </p>

        <button
          className="social-button"
          onClick={() => navigate("/profile")}
        >
          <span>G</span> Continue with Google
        </button>

        <button
          className="social-button"
          onClick={() => navigate("/profile")}
        >
          <span>f</span> Continue with Facebook
        </button>

        <button
          className="social-button"
          onClick={() => navigate("/profile")}
        >
          <span>●</span> Continue with Apple
        </button>

        <div className="divider">
          <span>or</span>
        </div>

        <button
          className="email-button"
          onClick={() => navigate("/profile")}
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

        <p className="privacy-note verification-hidden">
          Airport-community verification capability will be added later.
        </p>
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
          <strong>{props.score} {props.direction}</strong>
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

function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/transportation" element={<Transportation />} />
        <Route path="/find-a-ride" element={<FindRide />} />
        <Route
          path="/transportation-preview"
          element={<TransportationPreview />}
        />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ride-matches" element={<RideMatches />} />
<Route path="/match/:id" element={<MatchProfile />} />
<Route path="/request-ride" element={<RequestRide />} />
<Route path="/message-tasha" element={<MessageTasha />} />
<Route path="/request-sent" element={<RequestSent />} />
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