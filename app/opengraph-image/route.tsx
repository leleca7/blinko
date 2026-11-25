import { ImageResponse } from "next/og";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";

const size = { width: 1200, height: 630 };

// Social preview: same editorial palette and headline as the website.
export function GET() {
  return new ImageResponse(
    (
      <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"58px 76px",background:"#01301e",color:"#f6ece3",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:24,border:"1px solid #759180",borderRadius:4,display:"flex"}} />
        <div style={{position:"absolute",right:-130,top:60,width:510,height:510,border:"1px solid #6a8975",borderRadius:"50%",display:"flex"}} />
        <div style={{position:"absolute",right:-95,top:95,width:440,height:440,border:"1px solid #577564",borderRadius:"50%",display:"flex"}} />
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko Studio" width={155} height={73} style={{objectFit:"contain"}}/>
          <div style={{fontSize:16,letterSpacing:"0.14em",color:"#c5d5c7"}}>PRÉVIA INSTITUCIONAL</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",maxWidth:930}}>
          <div style={{fontSize:20,letterSpacing:"0.1em",color:"#c5d5c7",marginBottom:24}}>DIAGNÓSTICO E ESTRUTURAÇÃO DE NEGÓCIOS</div>
          <div style={{fontSize:86,fontFamily:"serif",letterSpacing:"-0.06em",lineHeight:1.02,display:"flex",flexDirection:"column"}}>
            <div>O problema</div>
            <div style={{color:"#efbad5",fontStyle:"italic"}}>nem sempre</div>
            <div>está onde parece.</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:19,color:"#d5e0d5"}}>
          <div>Diagnóstico · estratégia · estruturação</div>
          <div>blinko-imersiva.vercel.app</div>
        </div>
      </div>
    ), size,
  );
}
