import { useId } from 'react';

// Abstract cover art, drawn locally without a poster API or generated images.
export default function Artwork({ movie }) {
  const uid = useId().replace(/:/g, '');
  const id = Math.abs(movie.id || 1);
  const palettes = [['#112d40', '#387d81', '#e8b47b'], ['#282645', '#75618c', '#e9c8a0'], ['#27352d', '#6d8260', '#e0ca9b'], ['#472b30', '#a15a56', '#f0b890'], ['#16283f', '#426397', '#d7ac77'], ['#3a3329', '#a18756', '#f0d5a3']];
  const colors = palettes[id % palettes.length];
  return <div className="artwork"><svg viewBox="0 0 440 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id={`${uid}bg`} x1="0" x2="1" y2="1"><stop stopColor={colors[1]} /><stop offset="1" stopColor={colors[0]} /></linearGradient><radialGradient id={`${uid}sun`}><stop stopColor={colors[2]} /><stop offset="1" stopColor={colors[2]} stopOpacity=".35" /></radialGradient><pattern id={`${uid}grain`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="white" opacity=".16" /></pattern></defs>
    <rect width="440" height="280" fill={`url(#${uid}bg)`} />
    {id % 3 === 0 && <><circle cx="305" cy="100" r="74" fill={`url(#${uid}sun)`} /><ellipse cx="305" cy="100" rx="114" ry="24" fill="none" stroke={colors[2]} strokeWidth="2" transform="rotate(-28 305 100)" opacity=".65" /><path d="M0 250 130 166 221 224 350 175 440 226V280H0Z" fill={colors[0]} /><path d="M0 271 142 217 267 255 440 208V280H0Z" fill="#0b1324" opacity=".6" />{[38, 80, 133, 202, 356, 400].map((x, i) => <circle key={x} cx={x} cy={25 + i * 18 % 100} r="1.5" fill="#fff" opacity=".7" />)}</>}
    {id % 3 === 1 && <><circle cx="320" cy="83" r="54" fill={`url(#${uid}sun)`} /><path d="M0 245 100 113 176 198 257 64 440 265V280H0Z" fill={colors[0]} /><path d="m257 64-43 79 45-19 26 18Z" fill={colors[2]} opacity=".65" /><path d="M0 265 132 194 201 255 319 185 440 257V280H0Z" fill="#101b22" opacity=".8" /><path d="M210 280q-25-45 13-70t34-59" fill="none" stroke={colors[2]} opacity=".5" strokeWidth="2" /></>}
    {id % 3 === 2 && <><circle cx="325" cy="99" r="83" fill="none" stroke={colors[2]} opacity=".5" /><circle cx="325" cy="99" r="66" fill="none" stroke={colors[2]} opacity=".35" />{[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <g key={n}><rect x={n * 56 - 12} y={140 + (n * 43 % 85)} width="45" height="150" fill={colors[0]} /><path d={`M${n * 56 + 4} ${163 + (n * 43 % 85)}v42`} stroke={colors[2]} strokeWidth="3" opacity=".5" /></g>)}<path d="M220 280 304 152l41 128" fill={colors[2]} opacity=".11" /></>}
    <rect width="440" height="280" fill={`url(#${uid}grain)`} /><rect width="440" height="280" fill="#07101e" opacity=".18" />
  </svg><div className="artwork-caption"><span>THE FRAME COLLECTION</span><strong>{movie.title}</strong><small>{movie.genres?.[0] || 'Cinema'} <span> / </span> {movie.year || 'A story worth finding'}</small></div></div>;
}
