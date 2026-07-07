import * as React from "react";
export function SplashScreen({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Alfa+Slab+One&display=swap');
        .mhatre-splash{position:fixed;inset:0;z-index:9999;background:#A65D57;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:'Alfa Slab One',serif;}
        .mhatre-splash .splash{text-align:center;}
        .mhatre-splash .line{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;}
        .mhatre-splash .line--college{font-size:clamp(1.8rem,8vw,4.5rem);letter-spacing:.01em;}
        .mhatre-splash .line--app{margin-top:.3em;font-size:clamp(1.2rem,4.5vw,2.5rem);letter-spacing:.25em;}
        .mhatre-splash .word{display:inline-block;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18);opacity:0;transform:scale(.3);animation:mhatrePop .6s cubic-bezier(.34,1.56,.64,1) forwards;}
        .mhatre-splash .word + .word{margin-left:.3em;}
        .mhatre-splash .line--college .word:nth-child(1){animation-delay:0s;}
        .mhatre-splash .line--college .word:nth-child(2){animation-delay:.55s;}
        .mhatre-splash .line--app .word:nth-child(1){animation-delay:1.1s;}
        .mhatre-splash .underline{width:0;height:2px;background:#fff;margin:.6em auto 0;opacity:.85;animation:mhatreDraw .9s ease-out forwards;animation-delay:1.9s;}
        @keyframes mhatrePop{0%{opacity:0;transform:scale(.3);}40%{opacity:1;}100%{opacity:1;transform:scale(1);}}
        @keyframes mhatreDraw{to{width:60%;}}
      `}</style>
      <div className="mhatre-splash">
        <div className="splash">
          <span className="line line--college">
            <span className="word">Mhatre</span>
            <span className="word">College</span>
          </span>
          <span className="line line--app">
            <span className="word">App</span>
          </span>
          <div className="underline" />
        </div>
      </div>
    </>
  );
}
