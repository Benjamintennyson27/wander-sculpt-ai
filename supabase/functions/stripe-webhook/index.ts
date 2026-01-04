import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No stripe-signature header");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { customerId: session.customer, subscriptionId: session.subscription });
        
        if (session.customer && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          
          // Find user by email
          const customer = await stripe.customers.retrieve(customerId);
          if (customer.deleted) break;
          
          const email = customer.email;
          if (!email) {
            logStep("No email found for customer", { customerId });
            break;
          }

          // Find profile by email
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single();

          if (profile) {
            const updateData = {
              plan: "pro",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              period_generations_used: 0, // Reset on new subscription
              updated_at: new Date().toISOString(),
            };

            await supabase.from("profiles").update(updateData).eq("id", profile.id);
            logStep("Profile updated to Pro", { userId: profile.id });
          } else {
            logStep("Profile not found for email", { email });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });
        
        const customerId = subscription.customer as string;
        
        // Find profile by stripe_customer_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, current_period_end")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          const newPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
          const oldPeriodEnd = profile.current_period_end;
          
          // Check if this is a new billing period
          const isNewPeriod = oldPeriodEnd && new Date(newPeriodEnd) > new Date(oldPeriodEnd);
          
          const updateData: Record<string, unknown> = {
            subscription_status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: newPeriodEnd,
            updated_at: new Date().toISOString(),
          };

          // Reset period counter on new billing period
          if (isNewPeriod) {
            updateData.period_generations_used = 0;
            logStep("New billing period detected, resetting counter");
          }

          // Update plan based on status
          if (subscription.status === "active" || subscription.status === "trialing") {
            updateData.plan = "pro";
          } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
            updateData.plan = "free";
          }

          await supabase.from("profiles").update(updateData).eq("id", profile.id);
          logStep("Profile subscription updated", { userId: profile.id, status: subscription.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });
        
        const customerId = subscription.customer as string;
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabase.from("profiles").update({
            plan: "free",
            subscription_status: "canceled",
            updated_at: new Date().toISOString(),
          }).eq("id", profile.id);
          logStep("Profile reverted to free plan", { userId: profile.id });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
        
        // This handles subscription renewals
        if (invoice.subscription && invoice.billing_reason === "subscription_cycle") {
          const customerId = invoice.customer as string;
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (profile) {
            // Reset period counter on successful renewal
            await supabase.from("profiles").update({
              period_generations_used: 0,
              updated_at: new Date().toISOString(),
            }).eq("id", profile.id);
            logStep("Reset period generations on renewal", { userId: profile.id });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
