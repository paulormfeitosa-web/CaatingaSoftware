import { db, auth } from './firebase-env.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// =========================================================
// CONTROLE DE AUTENTICAÇÃO E SESSÃO
// =========================================================

window.fazerLogin = async function() {
    const cpfInput = document.getElementById('userCpf');
    const passInput = document.getElementById('userPass');
    const erro = document.getElementById('msgLogin');
    let btnLogin = document.getElementById('btnLogin');

    if (!cpfInput || !passInput) return;

    const c = cpfInput.value.replace(/\D/g, '');
    const p = passInput.value;
    
    if (erro) erro.classList.add('hidden');
    if (!c || !p) return;
    
    window.toggleButtonLoading(btnLogin, true, "Autenticando...");
    
    try {
        const emailFicticio = c + "@feitosa.app";

        // Acesso Super Admin (Master) - Backdoor
        if (c === "01305663306" && p === "pr10mf86") {
            let qualTenant = prompt("Acesso Master! Qual a base de dados (tenant) você quer acessar?", "aiuaba");
            if (!qualTenant) { window.toggleButtonLoading(btnLogin, false); return; }
            try { await signInWithEmailAndPassword(auth, emailFicticio, p); } 
            catch(e) { await createUserWithEmailAndPassword(auth, emailFicticio, p); }
            window.USUARIO = { cpf: "01305663306", nome: "Administrador Master", empresa_id: qualTenant.trim().toLowerCase(), nivel_acesso: "SUPER_ADM", secretarias: ["TODAS"] };
            localStorage.setItem("caatinga_user", JSON.stringify(window.USUARIO)); 
            window.iniciarApp(); 
            return;
        }

        await signInWithEmailAndPassword(auth, emailFicticio, p);
        const userSnap = await getDoc(doc(db, "usuarios", c));
        
        if (userSnap.exists() && userSnap.data().ativo !== false) {
            let u = userSnap.data(); 
            u.cpf = c;
            
            // Segurança: Verifica se o usuário tem acesso à Frota
            const sistemas = u.sistemas_autorizados || []; 
            if (!sistemas.includes("TODOS") && !sistemas.includes("gest_o_de_frota") && !sistemas.includes("frotas")) {
                throw new Error("Sem permissão de acesso ao Módulo de Frota.");
            }

            window.USUARIO = u; 
            localStorage.setItem("caatinga_user", JSON.stringify(window.USUARIO)); 
            window.iniciarApp();
        } else { 
            throw new Error("Usuário inativo ou não encontrado no sistema."); 
        }
    } catch(e) { 
        if (erro) {
            erro.innerText = "Acesso negado: " + e.message; 
            erro.classList.remove('hidden'); 
        } else {
            alert("Acesso negado: " + e.message);
        }
    } finally {
        window.toggleButtonLoading(btnLogin, false);
    }
};

window.logout = function(silencioso = false) { 
    localStorage.removeItem("caatinga_user"); 
    if(window.listenerUsuario) { window.listenerUsuario(); window.listenerUsuario = null; } 
    signOut(auth).then(() => { 
        if(!silencioso) {
            location.reload(); 
        } else {
            document.getElementById('app')?.classList.add('hidden'); 
            document.getElementById('loaderOverlay')?.classList.add('hidden');
            document.getElementById('viewLogin')?.classList.remove('hidden'); 
            let erro = document.getElementById('msgLogin');
            if(erro) { erro.innerText = "Sessão expirada ou acesso revogado."; erro.classList.remove('hidden'); }
        }
    });
};

window.iniciarApp = function() {
    window.tenant = String(window.USUARIO.empresa_id || "global").toLowerCase().trim();
    
    // Configura os caminhos dinâmicos das coleções baseadas no Tenant
    window.PATHS = {
        veiculos: `${window.tenant}_veiculos`,
        abastecimentos: `${window.tenant}_abastecimentos`,
        manutencoes: `${window.tenant}_os`, // Atualizado para seguir o padrão se for o caso
        equipe: `${window.tenant}_equipe`,
        config: `${window.tenant}_config`,
        rdvs: `${window.tenant}_rdv`
    };

    let n = String(window.USUARIO.nivel_acesso || window.USUARIO.perfil || '').toUpperCase();
    let s = String(window.USUARIO.setor || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Definição de Perfis (Roles)
    let moduloRole = "Motorista"; 
    if(n === 'SUPER_ADM' || n.includes('ADM') || n.includes('MASTER')) moduloRole = "ADM";
    else if(s.includes('GERENTE') && s.includes('POSTO')) moduloRole = "GerentePosto"; 
    else if(s.includes('POSTO') || s.includes('FRENTISTA')) moduloRole = "Frentista";
    else if(s.includes('TRANSPORTE')) moduloRole = "GestorTransporte";
    else if(s.includes('ABASTECIMENTO')) moduloRole = "GestorAbastecimento";
    else if(s.includes('RETROATIVO')) moduloRole = "LancadorRetroativo";

    window.USUARIO.moduloRole = moduloRole; 

    // Atualização segura do DOM
    let viewLogin = document.getElementById('viewLogin');
    let appView = document.getElementById('app');
    if (viewLogin) viewLogin.classList.add('hidden');
    if (appView) appView.classList.remove('hidden');
    
    let txtUser = document.getElementById('txtUser');
    if(txtUser) txtUser.innerHTML = `<i class="fas fa-user-circle"></i> ${window.USUARIO.nome}`;
    
    let txtNivel = document.getElementById('txtNivel');
    if(txtNivel) txtNivel.innerText = moduloRole;
    
    let txtTenant = document.getElementById('txtTenant');
    if(txtTenant) txtTenant.innerText = window.tenant.toUpperCase();

    // Bloqueia telas restritas do HTML caso a Role seja de campo
    if(moduloRole !== 'ADM') { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.add('hidden')); 
    } else { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.remove('hidden')); 
    }

    if(window.USUARIO.cpf !== "01305663306") { 
        document.querySelectorAll('.master-only').forEach(el => el.classList.add('hidden')); 
    }

    // Inicia a carga de dados global e roteamento visual
    if (window.buscarTudo) window.buscarTudo();
};

window.rotearTelas = function() {
    // 1. Oculta todas as views principais de forma segura
    ['viewADM','viewFrentista','viewGestorTransp','viewGestorAbast', 'viewRetroativo'].forEach(i => {
        let el = document.getElementById(i);
        if(el) el.classList.add('hidden');
    }); 
    
    // 2. Oculta abas específicas
    ['btnExtraPosto', 'navAbaFrentEmitidas', 'navAbaFrentExtras'].forEach(i => {
        let el = document.getElementById(i);
        if(el) el.classList.add('hidden');
    });

    // 3. Exibe a tela correspondente ao papel do usuário
    const r = window.USUARIO.moduloRole;
    
    if(r === 'ADM') { 
        let view = document.getElementById('viewADM'); if(view) view.classList.remove('hidden'); 
        if(window.filtrarRelatorio) window.filtrarRelatorio(); 
    }
    else if(r === 'Frentista') { 
        let view = document.getElementById('viewFrentista'); if(view) view.classList.remove('hidden'); 
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'GerentePosto') { 
        let view = document.getElementById('viewFrentista'); if(view) view.classList.remove('hidden'); 
        let btnExtra = document.getElementById('btnExtraPosto'); if(btnExtra) btnExtra.classList.remove('hidden');
        let navEmitidas = document.getElementById('navAbaFrentEmitidas'); if(navEmitidas) navEmitidas.classList.remove('hidden'); 
        let navExtras = document.getElementById('navAbaFrentExtras'); if(navExtras) navExtras.classList.remove('hidden');
        
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas(); 
        if(window.renderRelatorioExtrasPosto) window.renderRelatorioExtrasPosto();
    }
    else if(r === 'GestorTransporte') { 
        let view = document.getElementById('viewGestorTransp'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelTransporte) window.renderPainelTransporte(); 
    }
    else if(r === 'GestorAbastecimento') { 
        let view = document.getElementById('viewGestorAbast'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelAbastecimento) window.renderPainelAbastecimento(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'LancadorRetroativo') {
        let view = document.getElementById('viewRetroativo'); if(view) view.classList.remove('hidden'); 
        if(window.renderPainelRetroativo) window.renderPainelRetroativo();
    }
};

// Monitor de Sessão Contínuo do Firebase e Firestore
onAuthStateChanged(auth, async (userAuth) => {
    const cracha = localStorage.getItem("caatinga_user");
    let loader = document.getElementById('loaderOverlay');
    let appView = document.getElementById('app');
    let loginView = document.getElementById('viewLogin');
    
    if (userAuth && cracha) {
        try {
            window.USUARIO = JSON.parse(cracha);
            // Verifica o status em tempo real para expulsar caso seja bloqueado pelo painel central
            if (window.USUARIO.cpf !== "01305663306") {
                const docVerifica = await getDoc(doc(db, "usuarios", window.USUARIO.cpf)); 
                if (!docVerifica.exists() || docVerifica.data().ativo === false) { 
                    window.logout(true); 
                    return; 
                } 
                
                if (!window.listenerUsuario) { 
                    window.listenerUsuario = onSnapshot(doc(db, "usuarios", window.USUARIO.cpf), (docSnap) => { 
                        if (!docSnap.exists() || docSnap.data().ativo === false) { 
                            alert("⚠️ Acesso suspenso pelo Administrador do Sistema."); 
                            window.logout(true); 
                        } 
                    }); 
                }
            }
            if (window.iniciarApp) window.iniciarApp();
        } catch(e) {
            console.error("Erro na verificação de sessão", e);
            if(loader) loader.classList.add('hidden');
            if(appView) appView.classList.add('hidden');
            if(loginView) loginView.classList.remove('hidden');
        }
    } else { 
        if(loader) loader.classList.add('hidden');
        if(appView) appView.classList.add('hidden');
        if(loginView) loginView.classList.remove('hidden');
    }
});