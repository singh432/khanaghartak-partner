DROP TRIGGER IF EXISTS trg_notify_order_event ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_order_event_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_order_event_upd ON public.orders;

CREATE TRIGGER trg_notify_order_event_ins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();

CREATE TRIGGER trg_notify_order_event_upd
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();