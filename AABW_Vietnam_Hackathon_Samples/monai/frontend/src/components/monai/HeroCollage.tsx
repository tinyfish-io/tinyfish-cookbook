import banhmi from "@/assets/banhmi.webp";
import banhxeo from "@/assets/banhxeo.webp";
import capthrung from "@/assets/capthrung.webp";
import pho from "@/assets/pho.webp";

export function HeroCollage() {
  return (
    <div className="hero-plate" aria-hidden="true">
      <div className="hero-plate__rim" />
      <div className="hero-plate__inner">
        <img
          src={pho}
          alt=""
          className="hero-plate__item"
          style={{ width: "55%", top: "5%", left: "5%", zIndex: 2 }}
        />
        <img
          src={banhmi}
          alt=""
          className="hero-plate__item"
          style={{ width: "50%", top: "42%", right: "0%", zIndex: 3 }}
        />
        <img
          src={capthrung}
          alt=""
          className="hero-plate__item"
          style={{ width: "38%", bottom: "8%", left: "8%", zIndex: 4 }}
        />
        <img
          src={banhxeo}
          alt=""
          className="hero-plate__item"
          style={{ width: "42%", top: "18%", right: "5%", zIndex: 1 }}
        />
        <div className="steam-wisp" style={{ top: "8%", left: "30%" }} />
        <div className="steam-wisp" style={{ top: "6%", left: "38%" }} />
        <div className="steam-wisp" style={{ top: "10%", left: "26%" }} />
      </div>
    </div>
  );
}
