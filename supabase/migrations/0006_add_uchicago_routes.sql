-- UChicago Hyde Park / Kenwood shuttles (CTA routes 171 and 172).
insert into public.transit_routes (route_id, mode, name, color) values
  ('171', 'bus', '#171 U. of Chicago/Hyde Park', '#800000'),
  ('172', 'bus', '#172 U. of Chicago/Kenwood',   '#500000')
on conflict (route_id) do update
  set name = excluded.name, color = excluded.color;
