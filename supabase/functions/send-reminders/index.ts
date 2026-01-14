import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get reminders that are due and haven't been sent
    const now = new Date();
    const { data: reminders, error: fetchError } = await supabase
      .from("trip_reminders")
      .select(`
        *,
        trips:trip_id (destination, start_date, end_date)
      `)
      .is("sent_at", null)
      .lte("scheduled_for", now.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders to send" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const reminder of reminders) {
      const trip = reminder.trips;
      if (!trip) continue;

      const startDate = new Date(trip.start_date);
      const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let subject = "";
      let htmlContent = "";

      if (reminder.reminder_type === "before_trip") {
        subject = `🌍 Your trip to ${trip.destination} is in ${daysUntil} days!`;
        htmlContent = `
          <h1>Your adventure awaits!</h1>
          <p>Your trip to <strong>${trip.destination}</strong> starts on ${new Date(trip.start_date).toLocaleDateString()}.</p>
          <p>That's just ${daysUntil} days away!</p>
          <h2>Quick Checklist:</h2>
          <ul>
            <li>✅ Passport/ID ready</li>
            <li>✅ Travel insurance</li>
            <li>✅ Accommodation confirmed</li>
            <li>✅ Transport booked</li>
            <li>✅ Check weather forecast</li>
          </ul>
          <p>Have an amazing trip! 🎉</p>
          <p style="color: #666; font-size: 12px;">- TripTailor AI</p>
        `;
      } else if (reminder.reminder_type === "packing") {
        subject = `📦 Time to pack for ${trip.destination}!`;
        htmlContent = `
          <h1>Packing time!</h1>
          <p>Your trip to <strong>${trip.destination}</strong> is coming up in ${daysUntil} days.</p>
          <h2>Don't forget:</h2>
          <ul>
            <li>📱 Phone charger & adapters</li>
            <li>💊 Medications</li>
            <li>👕 Weather-appropriate clothing</li>
            <li>📋 Copies of important documents</li>
            <li>💳 Payment cards & some local currency</li>
          </ul>
          <p>Safe travels! ✈️</p>
          <p style="color: #666; font-size: 12px;">- TripTailor AI</p>
        `;
      }

      // Send email if Resend is configured
      if (resendApiKey && reminder.email) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "TripTailor <onboarding@resend.dev>",
              to: [reminder.email],
              subject,
              html: htmlContent,
            }),
          });

          if (emailResponse.ok) {
            // Mark as sent
            await supabase
              .from("trip_reminders")
              .update({ sent_at: now.toISOString() })
              .eq("id", reminder.id);

            results.push({ id: reminder.id, status: "sent" });
          } else {
            const errorData = await emailResponse.text();
            console.error("Resend error:", errorData);
            results.push({ id: reminder.id, status: "failed", error: errorData });
          }
        } catch (emailError) {
          console.error("Email send error:", emailError);
          results.push({ id: reminder.id, status: "failed", error: String(emailError) });
        }
      } else {
        // If no Resend key, just mark as processed (for testing)
        console.log(`Would send email to ${reminder.email}: ${subject}`);
        await supabase
          .from("trip_reminders")
          .update({ sent_at: now.toISOString() })
          .eq("id", reminder.id);
        results.push({ id: reminder.id, status: "processed_no_email" });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing reminders:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
