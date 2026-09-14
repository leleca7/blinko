import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isWhatsAppSchemaPending, markWhatsAppConversationRead } from "../../../../../../lib/blinko/whatsapp-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    await markWhatsAppConversationRead({ conversationId: id, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=read`, request.url), 303);
  } catch (error) {
    if (isWhatsAppSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao marcar conversa do WhatsApp como lida", error);
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=blocked`, request.url), 303);
  }
}
