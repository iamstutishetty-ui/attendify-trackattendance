
import * as React from "react";
const LETTERS = ["A", "t", "t", "e", "n", "d", "i", "f", "y"];
export function SplashScreen({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@800;900&display=swap');
        .splash-root{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#1E90D8;}
        .splash-wrap{position:relative;display:flex;align-items:center;justify-content:center;}
        .splash-word{display:flex;align-items:center;justify-content:center;animation:splashWordPop .55s cubic-bezier(.34,1.6,.64,1) forwards;animation-delay:2.1s;transform:scale(1);}
        @keyframes splashWordPop{0%{transform:scale(1);}55%{transform:scale(1.55);}100%{transform:scale(1.35);}}
        .splash-letter{font-family:'Poppins',sans-serif;font-weight:900;font-size:clamp(2.6rem,9vw,4rem);color:#ffffff;display:inline-block;opacity:0;transform:scale(0) translateY(20px);animation:splashLetterPop .3s cubic-bezier(.34,1.7,.64,1) forwards;text-shadow:0 0 24px rgba(255,255,255,.3),0 0 50px rgba(255,255,255,.1);}
        @keyframes splashLetterPop{0%{opacity:0;transform:scale(.2) translateY(24px);}65%{opacity:1;transform:scale(1.15) translateY(-4px);}100%{opacity:1;transform:scale(1) translateY(0);}}
        .splash-word .splash-letter:nth-child(1){animation-delay:0s;}
        .splash-word .splash-letter:nth-child(2){animation-delay:.14s;}
        .splash-word .splash-letter:nth-child(3){animation-delay:.28s;}
        .splash-word .splash-letter:nth-child(4){animation-delay:.42s;}
        .splash-word .splash-letter:nth-child(5){animation-delay:.56s;}
        .splash-word .splash-letter:nth-child(6){animation-delay:.70s;}
        .splash-word .splash-letter:nth-child(7){animation-delay:.84s;}
        .splash-word .splash-letter:nth-child(8){animation-delay:.98s;}
        .splash-word .splash-letter:nth-child(9){animation-delay:1.12s;}
        .splash-glow{position:absolute;width:200px;height:200px;border-radius:50%;border:2px solid rgba(255,255,255,.5);opacity:0;animation:splashRingBurst .7s ease-out forwards;animation-delay:2.15s;pointer-events:none;}
        @keyframes splashRingBurst{0%{transform:scale(.3);opacity:.8;}100%{transform:scale(2.5);opacity:0;}}
      `}</style>
      <div className="splash-root">
        <div className="splash-wrap">
          <div className="splash-word">
            {LETTERS.map((l, i) => (
              <span key={i} className="splash-letter">{l}</span>
            ))}
          </div>
          <div className="splash-glow" />
        </div>
      </div>
    </>
  );
}