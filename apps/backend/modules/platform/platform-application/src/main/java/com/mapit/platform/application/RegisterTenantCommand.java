package com.mapit.platform.application;

import com.mapit.platform.domain.BusinessVertical;

/** Datos necesarios para registrar una empresa en la plataforma. */
public record RegisterTenantCommand(String name, String slug, BusinessVertical vertical) {}
