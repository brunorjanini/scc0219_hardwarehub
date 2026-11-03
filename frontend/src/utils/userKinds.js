// Texts and paths of the two admin user pages. The same list and form
// components serve clients (type "user") and administrators ("admin").
export const USER_KINDS = {
  user: {
    type: "user",
    path: "/admin/clients",
    title: "Clientes",
    subtitle: "Consulte e mantenha as contas dos clientes da loja.",
    singular: "cliente",
    plural: "clientes",
    newLabel: "Novo cliente",
    editLabel: "Editar cliente",
    caption: "Clientes cadastrados",
    nameColumn: "Cliente",
    searchPlaceholder: "Nome ou e-mail",
    empty: "Nenhum cliente cadastrado.",
    deleteText:
      "A conta e o carrinho do cliente são apagados. Os pedidos dele continuam registrados no histórico da loja.",
  },
  admin: {
    type: "admin",
    path: "/admin/admins",
    title: "Administradores",
    subtitle: "Gerencie quem tem acesso ao painel administrativo.",
    singular: "administrador",
    plural: "administradores",
    newLabel: "Novo administrador",
    editLabel: "Editar administrador",
    caption: "Administradores cadastrados",
    nameColumn: "Administrador",
    searchPlaceholder: "Nome, e-mail ou usuário",
    empty: "Nenhum administrador cadastrado.",
    deleteText: "A pessoa perde o acesso ao painel administrativo.",
  },
};
