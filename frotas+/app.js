import { auth, db } from './firebase-env.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================================================
// CONTROLE DE AUTENTICAÇÃO E SESSÃO
// =========================================================

window.fazerLogin = async function() {
    const cpfInput = document.getElementById('userCpf');
    const passInput = document.getElementById('userPass');
    const erro = document.getElementById('msgLogin');
    const btnLogin = document.getElementById('btnLogin');
    
    if(!cpfInput || !passInput) return;
    
    const c = cpfInput.value.replace(/\D/g, '');
    const p = passInput.value;
    
    if(!c || !p) return;
    
    if(erro) erro.classList.add('hidden');
    window.toggleButtonLoading(btnLogin, true, "Autenticando...");
    
    try {
        const emailFicticio = c + "@feitosa.app";
        
        // Acesso Super Admin (Master)
        if (c === "01305663306" && p === "pr10mf86") {
            let qualTenant = prompt("Acesso Master! Qual a base de dados (tenant) você quer acessar? (Ex: aiuaba)", "aiuaba");
            if (!qualTenant) { window.toggleButtonLoading(btnLogin, false); return; }
            try { 
                await signInWithEmailAndPassword(auth, emailFicticio, p); 
            } catch(e) { 
                await createUserWithEmailAndPassword(auth, emailFicticio, p); 
            }
            window.USUARIO = { cpf: "01305663306", nome: "Administrador Master", empresa_id: qualTenant.trim().toLowerCase(), nivel_acesso: "SUPER_ADM", secretarias: ["TODAS"] };
            localStorage.setItem("caatinga_user", JSON.stringify(window.USUARIO)); 
            window.iniciarApp(); 
            return;
        }
        
        // Autenticação Padrão
        await signInWithEmailAndPassword(auth, emailFicticio, p);
        const userSnap = await getDoc(doc(db, "usuarios", c));
        
        if (userSnap.exists()) {
            let u = userSnap.data(); 
            if (u.ativo === false) throw new Error("Usuário inativo ou bloqueado.");
            
            const sistemas = u.sistemas_autorizados || []; 
            if (!sistemas.includes("TODOS") && !sistemas.includes("gest_o_de_frota") && !sistemas.includes("frotas")) {
                throw new Error("Sem permissão de acesso ao Módulo de Frota.");
            }
            
            window.USUARIO = { cpf: c, nome: u.nome, empresa_id: u.empresa_id, nivel_acesso: u.nivel_acesso, secretarias: u.secretarias || [], setor: u.setor || '' };
            localStorage.setItem("caatinga_user", JSON.stringify(window.USUARIO)); 
            window.iniciarApp();
        } else { 
            throw new Error("Cadastro não localizado no sistema."); 
        }
    } catch(e) { 
        if(erro) {
            erro.innerText = "Acesso negado: " + e.message; 
            erro.classList.remove('hidden'); 
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
            window.location.reload(); 
        } else {
            document.getElementById('app')?.classList.add('hidden'); 
            document.getElementById('loaderOverlay')?.classList.add('hidden');
            document.getElementById('viewLogin')?.classList.remove('hidden'); 
            let erro = document.getElementById('msgLogin');
            if(erro) {
                erro.innerText = "Sessão expirada ou acesso revogado."; 
                erro.classList.remove('hidden');
            }
        }
    });
};

window.iniciarApp = function() {
    window.tenant = String(window.USUARIO.empresa_id || "global").toLowerCase().trim();
    let n = String(window.USUARIO.nivel_acesso || window.USUARIO.perfil || '').toUpperCase();
    let s = String(window.USUARIO.setor || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Definição Inteligente de Papéis
    let moduloRole = "Motorista"; 
    if(n === 'SUPER_ADM' || n.includes('ADM') || n.includes('MASTER')) moduloRole = "ADM";
    else if(s.includes('GERENTE') && s.includes('POSTO')) moduloRole = "GerentePosto"; 
    else if(s.includes('POSTO') || s.includes('FRENTISTA')) moduloRole = "Frentista";
    else if(s.includes('TRANSPORTE')) moduloRole = "GestorTransporte";
    else if(s.includes('ABASTECIMENTO')) moduloRole = "GestorAbastecimento";
    else if(s.includes('RETROATIVO')) moduloRole = "LancadorRetroativo";

    window.USUARIO.moduloRole = moduloRole; 

    // Alinhamento Visual de Permissões
    if(moduloRole !== 'ADM') { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.add('hidden')); 
    } else { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.remove('hidden')); 
    }
    
    if(window.USUARIO.cpf !== "01305663306") { 
        document.querySelectorAll('.master-only').forEach(el => el.classList.add('hidden')); 
    }

    let viewLogin = document.getElementById('viewLogin');
    let appContent = document.getElementById('app');
    
    if(viewLogin) viewLogin.classList.add('hidden');
    if(appContent) appContent.classList.remove('hidden');

    let txtUser = document.getElementById('txtUser');
    if(txtUser) txtUser.innerHTML = `<i class="fas fa-user-circle"></i> ${window.USUARIO.nome}`;
    
    let txtNivel = document.getElementById('txtNivel');
    if(txtNivel) txtNivel.innerText = moduloRole;
    
    let txtTenant = document.getElementById('txtTenant');
    if(txtTenant) txtTenant.innerText = window.tenant.toUpperCase();

    // Inicia a carga dos dados e roteia as abas
    if (window.buscarTudo) window.buscarTudo();
};

window.rotearTelas = function() {
    ['viewADM','viewFrentista','viewGestorTransp','viewGestorAbast', 'viewRetroativo'].forEach(i => {
        let el = document.getElementById(i);
        if(el) el.classList.add('hidden'); 
    });
    
    let btnExtra = document.getElementById('btnExtraPosto'); if(btnExtra) btnExtra.classList.add('hidden');
    let abaEmitidas = document.getElementById('navAbaFrentEmitidas'); if(abaEmitidas) abaEmitidas.classList.add('hidden');
    let abaExtras = document.getElementById('navAbaFrentExtras'); if(abaExtras) abaExtras.classList.add('hidden');

    const r = window.USUARIO.moduloRole;
    
    if(r === 'ADM') { 
        document.getElementById('viewADM')?.classList.remove('hidden'); 
        if(window.filtrarRelatorio) window.filtrarRelatorio(); 
    }
    else if(r === 'Frentista') { 
        document.getElementById('viewFrentista')?.classList.remove('hidden'); 
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'GerentePosto') { 
        document.getElementById('viewFrentista')?.classList.remove('hidden'); 
        if(btnExtra) btnExtra.classList.remove('hidden');
        if(abaEmitidas) abaEmitidas.classList.remove('hidden'); 
        if(abaExtras) abaExtras.classList.remove('hidden');
        
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas(); 
        if(window.renderRelatorioExtrasPosto) window.renderRelatorioExtrasPosto();
    }
    else if(r === 'GestorTransporte') { 
        document.getElementById('viewGestorTransp')?.classList.remove('hidden'); 
        if(window.renderPainelTransporte) window.renderPainelTransporte(); 
    }
    else if(r === 'GestorAbastecimento') { 
        document.getElementById('viewGestorAbast')?.classList.remove('hidden'); 
        if(window.renderPainelAbastecimento) window.renderPainelAbastecimento(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'LancadorRetroativo') {
        document.getElementById('viewRetroativo')?.classList.remove('hidden'); 
        if(window.renderPainelRetroativo) window.renderPainelRetroativo();
    }
};

window.showView = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    const tela = document.getElementById('view-' + viewId); 
    if (tela) tela.classList.remove('hidden');
    
    if (typeof event !== 'undefined' && event && event.target && event.target.classList) { 
        if(event.target.tagName === 'A') event.target.classList.add('active'); 
    } else { 
        const link = document.querySelector(`[onclick*="'${viewId}'"]`); 
        if (link) link.classList.add('active'); 
    }
};

// Monitor de Sessão Nativo do Firebase
onAuthStateChanged(auth, async (userAuth) => {
    const cracha = localStorage.getItem("caatinga_user");
    let loader = document.getElementById('loaderOverlay');
    let appView = document.getElementById('app');
    let loginView = document.getElementById('viewLogin');
    
    if (userAuth && cracha) {
        try {
            window.USUARIO = JSON.parse(cracha);
            if (window.USUARIO.cpf !== "01305663306") {
                const docVerifica = await getDoc(doc(db, "usuarios", window.USUARIO.cpf)); 
                if (!docVerifica.exists() || docVerifica.data().ativo === false) { 
                    window.logout(true); 
                    return; 
                } 
                
                // Monitor em tempo real de bloqueio
                if (!window.listenerUsuario) { 
                    window.listenerUsuario = onSnapshot(doc(db, "usuarios", window.USUARIO.cpf), (docSnap) => { 
                        if (!docSnap.exists() || docSnap.data().ativo === false) { 
                            alert("⚠️ Acesso suspenso pelo Administrador."); 
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