const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

exports.criarClienteSaaS = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores globais podem criar clientes.');
  }

  const tenantId = data.tenantId;
  const cpf = data.cpf;
  const nome = data.nome;
  const senha = data.senha;
  const plano = data.plano;

  try {
    const emailFicticio = `${cpf.replace(/\D/g, '')}@feitosa.app`;
    
    const userRecord = await auth.createUser({
      uid: cpf,
      email: emailFicticio,
      password: senha,
      displayName: nome,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenantId,
      plano: plano || 'bronze',
      role: 'operador'
    });

    await db.collection("usuarios").doc(cpf).set({
      nome: nome,
      cpf: cpf,
      empresa_id: tenantId,
      plano: plano || 'bronze',
      ativo: true,
      dataCriacao: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("tenants").doc(tenantId).set({
      nome: tenantId,
      planoAtivo: plano || 'bronze',
      status: 'ativo',
      dataCadastro: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, message: `Cliente ${nome} criado no tenant ${tenantId}.` };

  } catch (error) {
    console.error("Erro ao criar cliente SaaS:", error);
    throw new functions.https.HttpsError('internal', 'Erro ao processar criação.', error.message);
  }
});

exports.configurarSuperAdminInicial = functions.https.onCall(async (data, context) => {
  const adminCpf = data.cpfAdmin;
  const chaveSecreta = data.chaveSecreta;

  if (chaveSecreta === "PecuariaInteligenteMaster2026") {
    await auth.setCustomUserClaims(adminCpf, { role: 'superadmin', tenantId: 'global' });
    return { success: true, message: "Privilégios de Super Admin concedidos com sucesso." };
  } else {
    throw new functions.https.HttpsError('permission-denied', 'Chave secreta inválida.');
  }
});