// Single place that talks to the UnityWebWorks automation engine (n8n).
// Every WhatsApp/email alert for this product goes through here.

export async function notifyEngine(eventType, booking, business) {
  const url = process.env.ENGINE_WEBHOOK_URL;
  if (!url) {
    console.warn("ENGINE_WEBHOOK_URL not set — skipping engine notification");
    return;
  }

  const payload = {
    business_type: "general",
    event_type: eventType,
    business_name: business?.business_name || process.env.BUSINESS_NAME,
    customer_name: booking.customer_name,
    customer_phone: booking.customer_phone,
    customer_email: booking.customer_email || undefined,
    appointment_time: booking.appointment_time,
    owner_email: business?.owner_email || process.env.OWNER_EMAIL || undefined,
    owner_phone: business?.owner_phone || process.env.OWNER_PHONE || undefined
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error("Engine webhook returned", res.status, await res.text());
    }
  } catch (err) {
    console.error("Failed to reach automation engine:", err.message);
  }
}
