export type Rol = "admin" | "gerencia" | "direccion" | "empleado";

// Los valores de `rol` en base de datos (gerencia/direccion) no cambian
// aunque la etiqueta visible sí — evita un ALTER TYPE ... RENAME VALUE
// innecesario. "gerencia" se muestra como "Dirección General" y
// "direccion" como "Responsable de departamento".
export const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  gerencia: "Dirección General",
  direccion: "Responsable de departamento",
  empleado: "Empleado",
};

export const ROL_ORDER: Rol[] = ["admin", "gerencia", "direccion", "empleado"];
