import { useEffect } from "react";

const SRC = "https://feedback-sigma-ten.vercel.app/widget.js";
const APP_KEY = "app_547be9697542b7e93c3217aa";

export function FeedbackWidget() {
  useEffect(() => {
    let busy = false;
    let tries = 0;

    const ensure = () => {
      if (busy || document.querySelector("[data-feedback-widget]")) return;
      if (tries >= 4) return;
      tries += 1;
      busy = true;
      delete (window as { Feedback?: unknown }).Feedback;
      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.dataset.appKey = APP_KEY;
      script.dataset.theme = "light";
      const done = () => {
        busy = false;
        if (!document.querySelector("[data-feedback-widget]")) ensure();
      };
      script.onload = done;
      script.onerror = () => {
        busy = false;
      };
      document.body.appendChild(script);
    };

    ensure();
    const observer = new MutationObserver(ensure);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  return <script src={SRC} data-app-key={APP_KEY} data-theme="light" async />;
}
