import { app, db, auth } from "./firebase-config.js";
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";

const functions = getFunctions(app);

let modalInstanciaNovo = null;
let adminListener = null;

function loading(show, msg="A Processar...") {
  document.getElementById('loading-msg').innerText = msg;
  if(show) document.getElementById('loadingOverlay').classList.remove('oculto');
  else document.getElementById('loadingOverlay').classList.add('oculto');
}

window.showToast = function(msg) {
  document.getElementById('toastMsg').innerText = msg;
  new bootstrap.Toast(document.getElementById('liveToast')).show();
};

window.onload = function() {
  modalInstanciaNovo = new bootstrap.Modal(document.getElementById('modalNovoCliente'));

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.role === 'superadmin') {
          document.getElementById('telaLoginAdmin').classList.add('oculto');
          document.getElementById('sistemaAdmin').classList.remove('oculto');
          carregarTenants();
        } else {
          alert("Acesso Negado. Esta área é restrita ao Administrador do SaaS.");
          window.sairAdmin();
        }
      } catch (error) {
        window.sairAdmin();
      }
    } else {
      document.getElementById('sistemaAdmin').classList.add('oculto');
      document.getElementById('telaLoginAdmin').classList.remove('oculto');
    }
  });
};

window.logarAdmin = async function() {
  const email = document.getElementById('adminEmail').value;
  const senha = document.getElementById('adminSenha').value;
  document.getElementById('msgLogin').classList.add('oculto');
  loading(true, "A Autenticar no Painel...");
  
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch(e) {
    document.getElementById('msgLogin').innerText = "Credenciais inválidas ou sem permissão.";
    document.getElementById('msgLogin').classList.remove('oculto');
  } finally {
    loading(false);
  }
};

window.sairAdmin = function() {
  if(adminListener) adminListener();
  signOut(auth).then(() => { window.location.reload(); });
};

window.abrirModalNovoCliente = function() {
  document.getElementById('novo-tenantId').value = "";
  document.getElementById('novo-nome').value = "";
  document.getElementById('novo-cpf').value = "";
  document.getElementById('novo-plano').value = "bronze";
  document.getElementById('novo-senha').value = "Mudar@123";
  modalInstanciaNovo.show();
};

window.criarNovoCliente = async function() {
  const btnSalvar = document.getElementById('btn-criar-cliente');
  btnSalvar.disabled = true; 
  btnSalvar.innerText = "Aguarde, gerando acesso...";
  
  const tenantIdRaw = document.getElementById('novo-tenantId').value;
  const tenantId = tenantIdRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
  const cpf = document.getElementById('novo-cpf').value.replace(/\D/g, '');
  const nome = document.getElementById('novo-nome').value;
  const senha = document.getElementById('novo-senha').value;
  const plano = document.getElementById('novo-plano').value;

  if(cpf.length !== 11) {
    alert("O CPF deve conter exatamente 11 dígitos.");
    btnSalvar.disabled = false; btnSalvar.innerText = "Gerar Acesso e Criar Banco";
    return;
  }

  loading(true, "Implantando banco de dados do cliente...");
  
  try {
    const criarClienteSaaS = httpsCallable(functions, 'criarClienteSaaS');
    const result = await criarClienteSaaS({ tenantId, cpf, nome, senha, plano });
    
    if(result.data.success) {
      showToast("Cliente implantado com sucesso!");
      modalInstanciaNovo.hide();
    }
  } catch(e) {
    console.error(e);
    alert("Erro ao criar cliente. Verifique se a Cloud Function está ativa e se você tem permissão.");
  }
  
  btnSalvar.disabled = false; 
  btnSalvar.innerText = "Gerar Acesso e Criar Banco";
  loading(false);
};

function carregarTenants() {
  loading(true, "Carregando clientes ativos...");
  adminListener = onSnapshot(collection(db, "tenants"), (snapshot) => {
    let html = "";
    snapshot.forEach((docSnap) => {
      let t = docSnap.data();
      let badgeCor = t.planoAtivo === 'ouro' ? 'bg-warning text-dark' : (t.planoAtivo === 'prata' ? 'bg-secondary' : 'bg-dark');
      let statusCor = t.status === 'ativo' ? 'text-success' : 'text-danger';
      
      html += `
      <tr>
        <td class="ps-4 py-3 fw-bold text-dark">${docSnap.id}</td>
        <td><span class="badge ${badgeCor} text-uppercase">${t.planoAtivo}</span></td>
        <td class="${statusCor} fw-bold"><i class="bi bi-record-circle-fill"></i> ${t.status.toUpperCase()}</td>
        <td class="text-end pe-4">
          <button class="btn btn-sm ${t.status === 'ativo' ? 'btn-outline-danger' : 'btn-outline-success'} fw-bold" onclick="window.alterarStatus('${docSnap.id}', '${t.status}')">
            ${t.status === 'ativo' ? 'Suspender Acesso' : 'Reativar Acesso'}
          </button>
        </td>
      </tr>`;
    });
    document.getElementById('tabela-clientes').innerHTML = html || "<tr><td colspan='4' class='text-center py-4 text-muted'>Nenhum cliente cadastrado no momento.</td></tr>";
    loading(false);
  }, (error) => {
    console.error("Erro ao carregar tenants:", error);
    loading(false);
  });
}

window.alterarStatus = async function(tenantId, statusAtual) {
  const novoStatus = statusAtual === 'ativo' ? 'suspenso' : 'ativo';
  if(confirm(`Tem certeza que deseja ${statusAtual === 'ativo' ? 'SUSPENDER' : 'REATIVAR'} o acesso da propriedade ${tenantId}?`)) {
    loading(true, "Alterando status...");
    try {
      await updateDoc(doc(db, "tenants", tenantId), { status: novoStatus });
      showToast(`Status alterado para ${novoStatus.toUpperCase()}.`);
    } catch(e) {
      alert("Erro ao alterar o status do cliente.");
    }
    loading(false);
  }
};

window.setupPrimeiroAdmin = async function() {
  const emailAdmin = prompt("Digite o E-mail que será o Super Administrador:");
  const senhaAdmin = prompt("Digite a Senha para este Administrador:");
  const cpfAdmin = prompt("Digite um CPF fictício para registro de log (somente números):");

  if(!emailAdmin || !senhaAdmin || !cpfAdmin) return;

  loading(true, "Configurando Master Admin...");
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, emailAdmin, senhaAdmin);
    
    const configurarSuperAdminInicial = httpsCallable(functions, 'configurarSuperAdminInicial');
    await configurarSuperAdminInicial({ 
      cpfAdmin: userCredential.user.uid, 
      chaveSecreta: "PecuariaInteligenteMaster2026" 
    });

    alert("Super Admin configurado com sucesso! Recarregue a página e faça login.");
    window.location.reload();
  } catch(e) {
    console.error(e);
    alert("Erro ao configurar primeiro admin. Veja o console.");
  }
  loading(false);
};