package com.mapit.platform.domain;

import java.util.List;

/** Página de solicitudes del ámbito técnico de plataforma. */
public record BusinessApplicationPage(
    List<BusinessApplication> content, int page, int size, long totalElements, int totalPages) {}
