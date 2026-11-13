import { useState } from "react";
import { Landing } from "./views/Landing";
import { MissionControl } from "./views/MissionControl";

export default function App() {
  const [entered, setEntered] = useState(() => {
    try {
      return sessionStorage.getItem("nexus-entered") === "1";
    } catch {
      return false;
    }
  });

  if (!entered) {
    return (
      <div className="app-bg">
        <Landing
          onEnter={() => {
            try {
              sessionStorage.setItem("nexus-entered", "1");
            } catch {
              /* ignore */
            }
            setEntered(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-bg">
      <MissionControl onLeave={() => setEntered(false)} />
    </div>
  );
}
