import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock3, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { loginWithGoogle } from "../services/api";
import { saveSession } from "../utils/auth";
import "../styles/google-auth.css";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
let sdkPromise;

function loadGoogleSDK() {
  if (window.google?.accounts?.id)
    return Promise.resolve(window.google.accounts.id);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=id";
      script.async = true;
      const timeout = window.setTimeout(() => fail(), 15000);
      function fail() {
        window.clearTimeout(timeout);
        script.remove();
        reject(
          new Error(
            "Google tidak dapat dimuat. Periksa koneksi lalu coba lagi.",
          ),
        );
      }
      script.onload = () => {
        window.clearTimeout(timeout);
        if (window.google?.accounts?.id) resolve(window.google.accounts.id);
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"
      />
      <path
        fill="#EA4335"
        d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  mode = "login",
  experienceLevel = "beginner",
  disabled,
  onError,
  onBusyChange,
}) {
  const navigate = useNavigate();
  const statusId = useId();
  const container = useRef(null);
  const current = useRef(null);
  const inFlight = useRef(false);
  const [status, setStatus] = useState(clientId ? "loading" : "unavailable");
  const [attempt, setAttempt] = useState(0);
  useLayoutEffect(() => {
    current.current = { experienceLevel, disabled, onError, onBusyChange };
  }, [experienceLevel, disabled, onError, onBusyChange]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogleSDK()
      .then((google) => {
        if (!active || !container.current) return;
        google.initialize({
          client_id: clientId,
          auto_select: false,
          callback: async ({ credential }) => {
            if (!active || inFlight.current || current.current.disabled) return;
            inFlight.current = true;
            current.current.onError("");
            current.current.onBusyChange(true);
            setStatus("busy");
            try {
              const data = await loginWithGoogle(
                credential,
                current.current.experienceLevel,
              );
              if (!active) return;
              saveSession(data);
              navigate("/dashboard");
            } catch (error) {
              if (active) current.current.onError(error.message);
            } finally {
              inFlight.current = false;
              if (active) {
                setStatus("ready");
                current.current.onBusyChange(false);
              }
            }
          },
        });
        container.current.replaceChildren();
        google.renderButton(container.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: mode === "register" ? "signup_with" : "signin_with",
          locale: "id",
          width: Math.floor(Math.min(container.current.parentElement.clientWidth - 8, 400)),
        });
        setStatus("ready");
      })
      .catch((error) => {
        if (active) {
          setStatus("failed");
          current.current.onError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [mode, navigate, attempt]);

  return (
    <div className="google-auth" data-status={status}>
      <div className="auth-divider">
        <span>atau lanjutkan dengan Google</span>
      </div>
      <div className="google-auth-card">
        <div className="google-auth-heading">
          <span className="google-auth-eyebrow"><Sparkles size={13} aria-hidden="true" /> Akses lebih praktis</span>
          <span className={`google-auth-badge${status === "unavailable" ? " is-pending" : ""}`}>
            {status === "unavailable" ? "Belum aktif" : "Tanpa password"}
          </span>
        </div>
        <div className="google-auth-control" aria-describedby={statusId} aria-busy={status === "loading" || status === "busy"}>
          <div
            ref={container}
            className="google-auth-button"
            hidden={status !== "ready"}
            inert={disabled || status !== "ready" ? true : undefined}
          />
          {status !== "ready" && (
            <button
              type="button"
              className="google-auth-fallback"
              aria-describedby={statusId}
              disabled={status !== "failed" || disabled}
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              <span className="google-auth-mark"><GoogleMark /></span>
              <span className="google-auth-label">
                {status === "loading"
                  ? "Memuat Google..."
                  : status === "busy"
                    ? "Memverifikasi akun..."
                    : status === "failed"
                      ? "Coba muat Google lagi"
                      : mode === "register"
                        ? "Daftar dengan Google"
                        : "Masuk dengan Google"}
              </span>
              {status === "loading" || status === "busy"
                ? <LoaderCircle className="google-auth-spinner" size={17} aria-hidden="true" />
                : <ArrowRight className="google-auth-arrow" size={17} aria-hidden="true" />}
            </button>
          )}
        </div>
        <p id={statusId} className="google-auth-note" role="status" aria-live="polite">
          {status === "unavailable" ? <Clock3 size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}
          <span>{status === "unavailable"
            ? "Gunakan email untuk masuk sementara."
            : status === "failed"
              ? "Periksa koneksi, lalu coba kembali."
              : status === "busy"
                ? "Sebentar, kami sedang menyiapkan akunmu."
                : "Password Google tetap pribadi."}</span>
        </p>
      </div>
    </div>
  );
}
