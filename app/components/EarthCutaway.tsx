import styles from "../immersive-home.module.css";

/**
 * Representação ilustrativa da descida pelo terreno:
 * grama → solo → raízes, sem círculos ou discos flutuantes.
 */
const blades = Array.from({ length: 62 }, (_, i) => ({
  x: 84 + i * 10.6,
  y: 218 - Math.sin(i / 8) * 8,
  height: 11 + (i * 17) % 19,
  lean: ((i * 7) % 13) - 6,
}));
const grains = Array.from({ length: 90 }, (_, i) => ({
  x: 100 + (i * 67) % 590,
  y: 290 + (i * 97) % 385,
  radius: .8 + (i * 13) % 23 / 10,
}));
const roots: Array<[string,number]> = [
 ["M402 250 C404 292 389 328 401 359 S420 433 400 472 S383 568 390 615 S390 697 375 748",12],
 ["M399 342 C363 366 342 392 319 430 S288 496 254 537 S220 593 189 641",7.8],
 ["M404 379 C446 397 472 428 487 466 S502 528 542 570 S573 633 609 673",7.2],
 ["M401 454 C360 468 332 495 314 530 S282 568 256 600",5.4],
 ["M406 468 C458 484 458 532 483 550 S516 595 529 647",5.7],
 ["M386 557 C354 565 345 600 315 634 S289 684 270 712",4.5],
 ["M392 607 C438 622 466 650 476 690 S488 729 510 750",4],
 ["M320 430 C304 417 284 412 259 397 S235 376 213 378",3.2],
 ["M297 491 C273 476 255 467 229 463 S183 450 165 436",2.7],
 ["M253 536 C224 526 210 550 189 565 S163 585 138 592",2.6],
 ["M256 599 C231 620 212 643 202 662 S182 692 170 707",2.5],
 ["M488 466 C515 443 538 445 560 427 S587 397 611 390",3],
 ["M501 527 C534 522 555 533 582 558 S616 595 654 589",2.5],
 ["M547 572 C552 605 569 628 602 641 S631 651 654 674",2.1],
 ["M319 636 C323 664 310 680 304 713 S297 744 280 760",2],
 ["M473 691 C454 706 449 731 450 752",1.8],
 ["M375 748 C354 760 347 777 340 791",1.5],
 ["M403 353 C428 339 440 332 462 326",2.6],
 ["M362 361 C343 349 319 334 291 339",2],
];
export default function EarthCutaway(){
 return <>
  <div className={styles.earthCutaway} aria-hidden="true">
   <svg className={styles.earthCutawaySvg} viewBox="0 0 820 840" xmlns="http://www.w3.org/2000/svg">
    <defs>
     <linearGradient id="bl-turf" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stopColor="#98b97a"/><stop offset=".5" stopColor="#367b4c"/><stop offset="1" stopColor="#123f2e"/>
     </linearGradient>
     <linearGradient id="bl-humus" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stopColor="#746047"/><stop offset=".48" stopColor="#5e4435"/><stop offset="1" stopColor="#392a24"/>
     </linearGradient>
     <linearGradient id="bl-soil" x1="0" y1="0" x2=".9" y2="1">
      <stop offset="0" stopColor="#c99d7b"/><stop offset=".48" stopColor="#ad775b"/><stop offset="1" stopColor="#7b5243"/>
     </linearGradient>
     <linearGradient id="bl-deep" x1="0" y1="0" x2=".8" y2="1">
      <stop offset="0" stopColor="#936451"/><stop offset=".6" stopColor="#654131"/><stop offset="1" stopColor="#31241e"/>
     </linearGradient>
     <linearGradient id="bl-side" x1="0" y1="0" x2="1" y2=".5">
      <stop offset="0" stopColor="#4a322a"/><stop offset="1" stopColor="#241d18"/>
     </linearGradient>
     <linearGradient id="bl-root" x1="0" y1="0" x2=".8" y2="1">
      <stop offset="0" stopColor="#ffddaf"/><stop offset=".65" stopColor="#d8b38b"/><stop offset="1" stopColor="#8c684f"/>
     </linearGradient>
     <clipPath id="bl-earth-clip">
      <path d="M77 231 C197 216 321 233 420 221 S617 227 731 211 L721 681 C631 693 569 680 475 700 S300 690 219 704 S113 695 78 703 Z"/>
     </clipPath>
     <filter id="bl-earth-shadow" x="-30%" y="-20%" width="165%" height="165%">
      <feDropShadow dx="1" dy="25" stdDeviation="20" floodColor="#160f0a" floodOpacity=".3"/>
     </filter>
    </defs>
    <g className={styles.earthLandmass} filter="url(#bl-earth-shadow)">
     <path d="M728 213 L777 241 L772 697 Q748 715 718 681 Z" fill="url(#bl-side)" opacity=".92"/>
     <g clipPath="url(#bl-earth-clip)">
      <path d="M65 215 H740 V344 H65 Z" fill="url(#bl-humus)"/>
      <path d="M65 317 C185 324 254 312 340 329 S550 330 741 314 L743 505 Q565 500 416 511 T65 505 Z" fill="url(#bl-soil)"/>
      <path d="M65 474 C203 468 255 495 385 483 S562 473 741 492 V735 H65 Z" fill="url(#bl-deep)"/>
      <path d="M64 341 Q166 330 276 346 T493 340 T742 343" stroke="#f0c4a1" strokeWidth="4" strokeOpacity=".3" fill="none"/>
      <path d="M66 502 C155 490 240 510 318 497 S522 501 742 504" stroke="#f7dfc1" strokeWidth="5" strokeOpacity=".28" fill="none"/>
      <path d="M66 591 C189 604 300 575 419 598 S615 590 742 605" stroke="#211914" strokeWidth="10" strokeOpacity=".17" fill="none"/>
      {grains.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={p.radius} fill={i%3===0?"#f8ddbc":"#211914"} opacity={i%3===0?.18:.14}/>)}
      <g className={styles.earthRootWeb}>
       {roots.map(([d,width],i)=><g key={i}>
        <path d={d} fill="none" stroke="#31251d" strokeWidth={width+4} strokeLinecap="round" opacity=".32"/>
        <path d={d} fill="none" stroke="url(#bl-root)" strokeWidth={width} strokeLinecap="round"/>
       </g>)}
       <path d="M193 641l-38 24m38-26-22-9m77-42-26 31m92-95 23 29m-113-86-38-10m344 129 40 20m-10 37 30 17m-62-85 22-27m-38 137 14 28m-99-3-20 31m33-66 29 10m-177-40-34 18m84 57 10 39m144 18 29 16" stroke="#e8c49e" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".6"/>
      </g>
     </g>
     <path d="M76 221 C194 211 323 220 420 211 S623 219 740 206 L738 249 C625 257 502 250 405 257 S170 248 76 257 Z" fill="url(#bl-turf)"/>
     <path d="M79 214 C220 208 329 215 452 206 S644 211 740 205" stroke="#c6d4a0" strokeWidth="5" strokeOpacity=".65" fill="none"/>
     <g className={styles.earthGrassBlades} strokeLinecap="round" fill="none">
      {blades.map((b,i)=><g key={i} stroke={i%3===0?"#9db976":i%4===0?"#367b4c":"#5a9454"} strokeWidth={i%5===0?2.2:1.5}>
       <path d={"M"+b.x+" "+b.y+"q"+b.lean+" "+(-b.height/2)+" "+b.lean+" "+(-b.height)}/>
       {i%4===0&&<path d={"M"+b.x+" "+b.y+"q"+(-b.lean-6)+" "+(-b.height/2)+" "+(-b.lean-8)+" "+(-b.height*.75)}/>}
      </g>)}
     </g>
     <path d="M403 221 Q405 236 402 251" stroke="#baa082" strokeWidth="10" strokeLinecap="round" fill="none"/>
    </g>
   </svg>
  </div>
  <div className={styles.mobileEarthDecor} aria-hidden="true">
   <div className={styles.mobileGrassEdge}>
    <svg viewBox="0 0 430 76" preserveAspectRatio="none">
     <path d="M0 70 L0 40 L9 55 L19 10 L27 53 L38 20 L48 53 L60 4 L70 51 L85 13 L98 58 L106 29 L118 53 L131 5 L145 48 L158 25 L167 55 L185 8 L196 49 L211 17 L221 54 L235 12 L249 52 L264 23 L275 52 L287 5 L300 55 L316 14 L326 56 L344 17 L358 52 L370 3 L382 55 L395 21 L410 50 L422 9 L430 46 L430 76 L0 76 Z" fill="#286448"/>
    </svg>
   </div>
   <svg className={styles.mobileRootIllustration} viewBox="0 0 420 550" fill="none">
    <g stroke="#eac59d" strokeLinecap="round">
     <path d="M216 15 C210 75 220 129 207 179 S198 289 207 332 S192 453 184 535" strokeWidth="10"/>
     <path d="M211 136 C158 157 150 195 123 230 S76 290 38 315" strokeWidth="6"/>
     <path d="M209 184 C266 204 292 231 305 267 S349 335 386 374" strokeWidth="7"/>
     <path d="M202 284 C155 299 142 332 129 368 S95 425 70 469" strokeWidth="5"/>
     <path d="M208 327 C263 348 289 400 306 444 S319 494 348 522" strokeWidth="4"/>
     <path d="M121 230 L93 202 M121 232 L84 244 M62 294 L33 273 M306 268 L356 250 M345 326 L377 311 M128 366 L87 346 M91 433 L54 437 M308 442 L271 452 M195 452 L230 475" strokeWidth="2.4"/>
    </g>
   </svg>
  </div>
 </>;
}
