package com.mapit.identity.application;

/**
 * Reglas mínimas de contraseña para el alta por invitación (CU-25). Las mismas
 * reglas que la consola muestra en el medidor de fortaleza: largo, mayúsculas
 * y minúsculas, un dígito y un símbolo.
 */
public final class PasswordPolicy {

  private static final int MIN_LENGTH = 8;
  private static final int MAX_LENGTH = 128;

  private PasswordPolicy() {}

  public static String validate(String password) {
    if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
      return "La contraseña debe tener entre 8 y 128 caracteres.";
    }
    if (password.chars().noneMatch(Character::isUpperCase)) {
      return "La contraseña necesita al menos una mayúscula.";
    }
    if (password.chars().noneMatch(Character::isLowerCase)) {
      return "La contraseña necesita al menos una minúscula.";
    }
    if (password.chars().noneMatch(Character::isDigit)) {
      return "La contraseña necesita al menos un número.";
    }
    if (password.chars().allMatch(Character::isLetterOrDigit)) {
      return "La contraseña necesita al menos un símbolo.";
    }
    return null;
  }

  /** Deriva un nombre visible a partir del correo de la invitación. */
  public static String defaultFullName(String email) {
    String local = email.split("@", 2)[0];
    return local.isEmpty() ? email : Character.toUpperCase(local.charAt(0)) + local.substring(1);
  }
}
