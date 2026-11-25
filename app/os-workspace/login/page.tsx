import {notFound} from "next/navigation";
import LoginForm from "./login-form";
export const dynamic="force-dynamic";
export const metadata={title:"Blinko OS — acesso experimental",robots:{index:false,follow:false}};
export default function Page(){
 if(process.env.BLINKO_OS_LAB_ENABLED!=="true"||process.env.VERCEL_ENV==="production")notFound();
 return <LoginForm/>;
}
