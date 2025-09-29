"use client";

export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <div className="tt-logo" aria-label="TripTrio">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
        className="tt-icon"
      >
        <defs>
          <linearGradient id="ttGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        {/* simple plane silhouette */}
        <path
          fill="url(#ttGrad)"
          d="M21 10.5c.7.3.7 1.2 0 1.5l-5.2 2.2-2.9 6.1c-.2.4-.8.4-1 0l-1.6-4.4-3.3 1.4c-.3.1-.6 0-.8-.3l-.4-.8c-.1-.3 0-.6.3-.8l3.3-1.4-4.4-1.6c-.4-.1-.4-.8 0-1l6.1-2.9L12 3c.3-.7 1.2-.7 1.5 0l1.9 4.3 5.6 3.2Z"
        />
      </svg>
      <span className="tt-wordmark">
        <span className="tt-word-1">Trip</span>
        <span className="tt-word-2">Trio</span>
      </span>

      <style jsx>{`
        .tt-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          user-select: none;
        }
        .tt-icon { display: block; }
        .tt-wordmark {
          font-weight: 900;
          font-size: 20px;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .tt-word-1 { color: #0f172a; }
        .tt-word-2 {
          background: linear-gradient(90deg, #06b6d4, #0ea5e9);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `}</style>
    </div>
  );
}
