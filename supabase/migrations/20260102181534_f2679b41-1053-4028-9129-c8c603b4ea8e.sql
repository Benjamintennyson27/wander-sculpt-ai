-- Change itinerary_item_id from UUID to TEXT since items in days JSON don't have UUIDs
ALTER TABLE place_verifications 
  ALTER COLUMN itinerary_item_id TYPE TEXT;