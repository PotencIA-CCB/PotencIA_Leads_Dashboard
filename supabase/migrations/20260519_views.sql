-- PotencIA Leads Dashboard
-- Migration 10: vistas para métricas
--
-- consultas_por_semana: picos semanales para la sección de métricas.

begin;

create or replace view public.consultas_por_semana as
select
  date_trunc('week', c.fecha)::date as semana_inicio,
  count(*) as total,
  count(distinct c.id_lead) as leads_atendidos,
  count(distinct c.id_consultor) as consultores_activos,
  count(*) filter (where c.status = 'Resuelto') as resueltas,
  count(*) filter (where c.status = 'En seguimiento') as en_seguimiento,
  coalesce(sum(c.duracion_minutos), 0) as minutos_totales,
  coalesce(sum(rs.cantidad_productos), 0) as productos_creados
from public.consultorias c
left join public.registro_sesion rs on rs.id_consultoria = c.id
group by date_trunc('week', c.fecha)::date
order by semana_inicio desc;

commit;
