export const airportWorkDestinations = [
  "Domestic Terminal",
  "International Terminal",
  "Delta TechOps",
  "Delta G.O.",
  "North Cargo Area",
  "South Cargo Area",
  "Rental Car Center",
  "Other Airport Area",
];

export const airportMeetupAreas = [
  ...airportWorkDestinations.filter((area) => area !== "Other Airport Area"),
  "Airport MARTA Station",
  "Other Airport Area",
];
