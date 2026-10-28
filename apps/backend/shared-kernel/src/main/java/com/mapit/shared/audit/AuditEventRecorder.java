package com.mapit.shared.audit;

/** Puerto transversal para añadir auditoría dentro de la transacción del caso de uso. */
public interface AuditEventRecorder {

  void record(AuditEvent event);
}
