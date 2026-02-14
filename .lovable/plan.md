

## Replace Destination Photo Gallery with Trip Countdown + Quick Stats

Remove the photo gallery section and replace it with a comprehensive Trip Countdown and Quick Stats dashboard that shows useful trip metrics at a glance.

### What You'll Get

A stats panel replacing the photo gallery that includes:
- **Trip Countdown** - using the existing `TripCountdown` component logic (days away, ongoing, completed)
- **Quick Stats Cards** - total activities, trip duration, total days, budget utilization
- **Budget Progress Bar** - visual indicator of estimated spend vs. budget
- **Category Breakdown** - food vs. activities cost split
- **Average Daily Cost** - per-day spending estimate
- **Verified Places Count** - how many places have been verified

### Technical Details

**1. Create `src/components/trip/TripQuickStats.tsx`**
- New component accepting `trip`, `itinerary`, and `budgetSummary` props
- Reuses existing `TripCountdown` for the countdown badge
- Uses existing `Progress` bar, `Card`, and `Badge` UI components
- Calculates stats from itinerary data (total activities, verified count, food items)
- Displays budget progress using `formatCurrency` from `budget-calculator.ts`
- Responsive card grid layout matching the existing design language

**2. Update `src/pages/TripDetail.tsx`**
- Remove `DestinationGallery` import and all references
- Import `TripQuickStats` component and `TripCountdown`
- Replace desktop sidebar (line 629-634): swap `DestinationGallery` for `TripQuickStats`
- Replace mobile overlay (line 842-870): swap gallery overlay for quick stats overlay
- Update mobile toggle button: change icon from `Camera` to `BarChart3` and label from "Photos" to "Stats"
- Pass `trip`, `currentItinerary`, and `budgetSummary` as props

**3. Optionally clean up `src/components/trip/DestinationGallery.tsx`**
- File can be deleted since it will no longer be used
- The `unsplash-photos` edge function can remain for potential future use

