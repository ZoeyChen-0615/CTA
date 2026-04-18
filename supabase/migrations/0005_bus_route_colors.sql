-- Give each bus route a distinct color so vehicles are visually distinguishable on the map.
-- Train colors stay as the official CTA line colors.
update public.transit_routes
set color = c.color
from (values
  ('3',   '#E91E63'),
  ('4',   '#9C27B0'),
  ('6',   '#3F51B5'),
  ('8',   '#2196F3'),
  ('9',   '#00BCD4'),
  ('12',  '#009688'),
  ('20',  '#4CAF50'),
  ('22',  '#8BC34A'),
  ('36',  '#CDDC39'),
  ('49',  '#FFC107'),
  ('53',  '#FF9800'),
  ('63',  '#FF5722'),
  ('66',  '#795548'),
  ('77',  '#607D8B'),
  ('79',  '#E040FB'),
  ('81',  '#673AB7'),
  ('82',  '#40C4FF'),
  ('146', '#18FFFF'),
  ('147', '#64DD17'),
  ('151', '#FFAB00')
) as c(route_id, color)
where transit_routes.route_id = c.route_id and transit_routes.mode = 'bus';
