import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Question flow definition
const QUESTIONS = [
  { key: 'destination', type: 'text', prompt: 'Where would you like to travel?', required: true },
  { key: 'is_family_trip', type: 'boolean', prompt: 'Is this a family trip?', required: true },
  { key: 'adults_count', type: 'number', prompt: 'How many adults are traveling?', required: true, condition: { key: 'is_family_trip', value: true } },
  { key: 'kids_count', type: 'number', prompt: 'How many kids are traveling?', required: false, condition: { key: 'is_family_trip', value: true } },
  { key: 'people_count', type: 'number', prompt: 'How many people are traveling?', required: true, condition: { key: 'is_family_trip', value: false } },
  { key: 'budget_amount', type: 'number', prompt: 'What is your total budget (in INR)?', required: true },
  { key: 'food_preference', type: 'select', prompt: 'What is your food preference?', options: ['restaurant', 'street_food', 'mixed'], required: true },
  { key: 'travel_style', type: 'select', prompt: 'What travel style do you prefer?', options: ['relaxed', 'adventure', 'mixed'], required: false },
  { key: 'interests', type: 'multi-select', prompt: 'What are your interests?', options: ['beaches', 'shopping', 'museums', 'nature', 'nightlife', 'spiritual', 'food', 'history', 'adventure', 'photography'], required: false },
  { key: 'pace', type: 'select', prompt: 'What pace do you prefer?', options: ['chill', 'medium', 'packed'], required: false },
  { key: 'dates', type: 'date_range', prompt: 'What are your travel dates?', required: true },
  { key: 'notes', type: 'text', prompt: 'Any additional notes or preferences?', required: false },
];

// Map question keys to trip columns
const QUESTION_TO_COLUMN: Record<string, string> = {
  destination: 'destination',
  is_family_trip: 'is_family',
  adults_count: 'adults_count',
  kids_count: 'kids_count',
  people_count: 'people_count',
  budget_amount: 'budget_inr',
  food_preference: 'food_pref',
  travel_style: 'travel_style',
  interests: 'interests',
  pace: 'pace',
  notes: 'notes',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`[trip-flow] Action: ${action}, User: ${user.id}`);

    // ACTION: CREATE - Create new trip and return first question
    if (action === 'create') {
      const { data: trip, error: createError } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          status: 'collecting',
          destination: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          budget_inr: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('[trip-flow] Create error:', createError);
        throw new Error('Failed to create trip');
      }

      console.log(`[trip-flow] Created trip: ${trip.id}`);

      return new Response(JSON.stringify({
        tripId: trip.id,
        nextQuestion: QUESTIONS[0],
        progress: { current: 1, total: QUESTIONS.length }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: ANSWER - Submit answer and get next question
    if (action === 'answer') {
      const body = await req.json();
      const { tripId, question_key, answer } = body;

      if (!tripId || !question_key) {
        return new Response(JSON.stringify({ error: 'tripId and question_key required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify trip ownership
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !trip) {
        return new Response(JSON.stringify({ error: 'Trip not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save answer to trip_answers
      await supabase.from('trip_answers').upsert({
        trip_id: tripId,
        question_key,
        answer_json: { value: answer }
      }, {
        onConflict: 'trip_id,question_key'
      });

      // Update trip column if mapped
      const columnName = QUESTION_TO_COLUMN[question_key];
      if (columnName) {
        const updateData: Record<string, unknown> = {};
        
        // Handle special cases
        if (question_key === 'dates' && answer) {
          updateData.start_date = answer.start_date;
          updateData.end_date = answer.end_date;
          // Calculate duration
          if (answer.start_date && answer.end_date) {
            const start = new Date(answer.start_date);
            const end = new Date(answer.end_date);
            updateData.duration_days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }
        } else {
          updateData[columnName] = answer;
        }

        await supabase.from('trips').update(updateData).eq('id', tripId);
      }

      console.log(`[trip-flow] Saved answer for ${question_key}: ${JSON.stringify(answer).substring(0, 100)}`);

      // Get all current answers to determine next question
      const { data: answers } = await supabase
        .from('trip_answers')
        .select('question_key, answer_json')
        .eq('trip_id', tripId);

      const answeredKeys = new Set(answers?.map(a => a.question_key) || []);
      const answersMap: Record<string, unknown> = {};
      answers?.forEach(a => { answersMap[a.question_key] = a.answer_json?.value; });

      // Find next unanswered question
      let nextQuestion = null;
      let questionIndex = 0;
      
      for (let i = 0; i < QUESTIONS.length; i++) {
        const q = QUESTIONS[i];
        
        // Check condition
        if (q.condition) {
          const conditionMet = answersMap[q.condition.key] === q.condition.value;
          if (!conditionMet) continue;
        }

        if (!answeredKeys.has(q.key)) {
          nextQuestion = q;
          questionIndex = i;
          break;
        }
      }

      // Calculate progress
      const applicableQuestions = QUESTIONS.filter(q => {
        if (!q.condition) return true;
        return answersMap[q.condition.key] === q.condition.value;
      });

      if (!nextQuestion) {
        // All questions answered, mark ready
        await supabase.from('trips').update({ status: 'draft' }).eq('id', tripId);
        
        return new Response(JSON.stringify({
          tripId,
          status: 'READY_TO_GENERATE',
          progress: { current: applicableQuestions.length, total: applicableQuestions.length }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        tripId,
        nextQuestion,
        progress: { 
          current: answeredKeys.size + 1, 
          total: applicableQuestions.length 
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: STATUS - Get current flow status
    if (action === 'status') {
      const tripId = url.searchParams.get('tripId');
      
      if (!tripId) {
        return new Response(JSON.stringify({ error: 'tripId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [tripResult, answersResult] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('trip_answers').select('question_key, answer_json').eq('trip_id', tripId)
      ]);

      if (tripResult.error || !tripResult.data) {
        return new Response(JSON.stringify({ error: 'Trip not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const answers = answersResult.data || [];
      const answeredKeys = new Set(answers.map(a => a.question_key));
      const answersMap: Record<string, unknown> = {};
      answers.forEach(a => { answersMap[a.question_key] = a.answer_json?.value; });

      // Find next unanswered question
      let nextQuestion = null;
      for (const q of QUESTIONS) {
        if (q.condition) {
          const conditionMet = answersMap[q.condition.key] === q.condition.value;
          if (!conditionMet) continue;
        }
        if (!answeredKeys.has(q.key)) {
          nextQuestion = q;
          break;
        }
      }

      return new Response(JSON.stringify({
        trip: tripResult.data,
        answers: answersMap,
        nextQuestion,
        status: nextQuestion ? 'collecting' : 'READY_TO_GENERATE'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: create, answer, status' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[trip-flow] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
