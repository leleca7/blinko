import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LAB_COOKIE } from "../../lib/os-lab/session";
import { isLabSessionActive } from "../../lib/os-lab/auth";
import ConnectedWorkspace from "./workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Blinko OS — laboratório protegido",robots:{index:false,follow:false}};
export default async function Page(){
 if(process.env.BLINKO_OS_LAB_ENABLED!=="true"||process.env.VERCEL_ENV==="production")notFound();
 const token=(await cookies()).get(LAB_COOKIE)?.value;
 if(!await isLabSessionActive(token))notFound();
 // The API independently checks revocation and project permissions for every operation.
 return <ConnectedWorkspace/>;
}
