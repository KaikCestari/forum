/** Desenho esquemático de um curso d'água; não representa dados de monitoramento. */
export function WaterIllustration() {
  return (
    <svg
      className="water-illustration"
      viewBox="0 0 420 270"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#a8e2d3" strokeWidth="1" opacity=".17">
        <path d="M110-20C45 45 144 72 90 127S12 200 36 290 M147-20C80 40 174 82 125 133S45 213 75 290 M180-20C115 43 201 86 157 141S88 224 109 290 M219-20C150 50 232 91 194 149S130 227 147 290 M250-20C184 47 270 97 232 158S167 239 189 290 M287-20C219 50 305 107 270 166S211 244 229 290 M325-20C259 57 345 113 310 174S249 251 273 290 M364-20C299 63 387 122 349 186S293 260 315 290 M403-20C336 62 423 130 390 193S335 265 356 290" />
      </g>
      <path
        d="M232-15C179 29 192 57 225 88S279 126 239 167 183 220 210 286"
        stroke="#1e6b70"
        strokeWidth="62"
      />
      <path
        d="M232-15C179 29 192 57 225 88S279 126 239 167 183 220 210 286"
        stroke="#4fa89d"
        strokeWidth="36"
      />
      <path
        d="M232-15C179 29 192 57 225 88S279 126 239 167 183 220 210 286"
        stroke="#b9e5cc"
        strokeWidth="1.5"
        strokeDasharray="4 8"
        opacity=".6"
      />
      <path
        d="M322 24c-9 45-55 46-86 71 M110 170c29-18 61-5 86 20"
        stroke="#1e6b70"
        strokeWidth="17"
      />
      <path
        d="M322 24c-9 45-55 46-86 71 M110 170c29-18 61-5 86 20"
        stroke="#4fa89d"
        strokeWidth="7"
      />
      {[
        { x: 207, y: 48 },
        { x: 255, y: 125 },
        { x: 203, y: 220 },
      ].map((p) => (
        <g key={p.y}>
          <circle cx={p.x} cy={p.y} r="16" fill="#b8edda" fillOpacity=".13" />
          <circle
            cx={p.x}
            cy={p.y}
            r="7"
            fill="#c9f1dc"
            stroke="#154c53"
            strokeWidth="3"
          />
          <circle cx={p.x} cy={p.y} r="2" fill="#287969" />
        </g>
      ))}
      <g transform="translate(292 175)">
        <rect width="98" height="41" rx="7" fill="#174e56" stroke="#397779" />
        <path
          d="m12 23 7-8 8 5 9-11"
          stroke="#a4e6c5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47 16h36 M47 24h24"
          stroke="#8ab4b1"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
