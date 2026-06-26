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
    const btnLogin = document.getElementById('btnLogin');
    
    if(!cpfInput || !passInput) return;
    
    const c = cpfInput.value.replace(/\D/g, '');
    const p = passInput.value;
    
    if(!c || !p) return;
    
    if(erro) erro.classList.add('hidden', 'd-none');
    if(window.toggleButtonLoading) window.toggleButtonLoading(btnLogin, true, "Autenticando...");
    
    try {
        const emailFicticio = c + "@feitosa.app";
        
        if (c === "01305663306" && p === "pr10mf86") {
            let qualTenant = prompt("Acesso Master! Qual a base de dados (tenant) você quer acessar? (Ex: aiuaba)", "aiuaba");
            if (!qualTenant) { if(window.toggleButtonLoading) window.toggleButtonLoading(btnLogin, false); return; }
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
            erro.classList.remove('hidden', 'd-none'); 
        } else {
            alert("Acesso negado: " + e.message);
        }
    } finally { 
        if(window.toggleButtonLoading) window.toggleButtonLoading(btnLogin, false); 
    }
};

window.logout = function(silencioso = false) { 
    localStorage.removeItem("caatinga_user"); 
    if(window.listenerUsuario) { window.listenerUsuario(); window.listenerUsuario = null; } 
    signOut(auth).then(() => {
        if(!silencioso) { 
            window.location.reload(); 
        } else {
            document.getElementById('app')?.classList.add('hidden', 'd-none'); 
            document.getElementById('loaderOverlay')?.classList.add('hidden', 'd-none');
            document.getElementById('viewLogin')?.classList.remove('hidden', 'd-none'); 
            let erro = document.getElementById('msgLogin');
            if(erro) {
                erro.innerText = "Sessão expirada ou acesso revogado."; 
                erro.classList.remove('hidden', 'd-none');
            }
        }
    });
};

window.iniciarApp = function() {
    window.tenant = String(window.USUARIO.empresa_id || "global").toLowerCase().trim();
    
    window.PATHS = {
        veiculos: `${window.tenant}_veiculos`,
        abastecimentos: `${window.tenant}_abastecimentos`,
        manutencoes: `${window.tenant}_os`,
        equipe: `${window.tenant}_equipe`,
        config: `${window.tenant}_config`,
        rdvs: `${window.tenant}_rdv`
    };

    let n = String(window.USUARIO.nivel_acesso || window.USUARIO.perfil || '').toUpperCase();
    let s = String(window.USUARIO.setor || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let moduloRole = "Motorista"; 
    if(n === 'SUPER_ADM' || n.includes('ADM') || n.includes('MASTER')) moduloRole = "ADM";
    else if(s.includes('GERENTE') && s.includes('POSTO')) moduloRole = "GerentePosto"; 
    else if(s.includes('POSTO') || s.includes('FRENTISTA')) moduloRole = "Frentista";
    else if(s.includes('TRANSPORTE')) moduloRole = "GestorTransporte";
    else if(s.includes('ABASTECIMENTO')) moduloRole = "GestorAbastecimento";
    else if(s.includes('RETROATIVO')) moduloRole = "LancadorRetroativo";

    window.USUARIO.moduloRole = moduloRole; 

    if(moduloRole !== 'ADM') { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.add('hidden', 'd-none')); 
    } else { 
        document.querySelectorAll('.adm-only').forEach(el => el.classList.remove('hidden', 'd-none')); 
    }
    
    if(window.USUARIO.cpf !== "01305663306") { 
        document.querySelectorAll('.master-only').forEach(el => el.classList.add('hidden', 'd-none')); 
    }

    let viewLogin = document.getElementById('viewLogin');
    if(viewLogin) viewLogin.classList.add('hidden', 'd-none');
    
    let appContent = document.getElementById('app');
    if(appContent) {
        appContent.classList.remove('hidden', 'd-none');
        appContent.style.display = 'block'; 
    }

    let txtUser = document.getElementById('txtUser');
    if(txtUser) txtUser.innerHTML = `<i class="fas fa-user-circle"></i> ${window.USUARIO.nome}`;
    
    let txtNivel = document.getElementById('txtNivel');
    if(txtNivel) txtNivel.innerText = moduloRole;
    
    let txtTenant = document.getElementById('txtTenant');
    if(txtTenant) txtTenant.innerText = window.tenant.toUpperCase();

    // Orquestra a exibição da tela antes de buscar os dados
    window.rotearTelas();
    if (window.buscarTudo) window.buscarTudo();
};

window.rotearTelas = function() {
    ['viewADM','viewFrentista','viewGestorTransp','viewGestorAbast', 'viewRetroativo'].forEach(i => {
        let el = document.getElementById(i);
        if(el) {
            el.classList.add('hidden', 'd-none'); 
            el.style.display = 'none';
        }
    });
    
    let btnExtra = document.getElementById('btnExtraPosto'); if(btnExtra) btnExtra.classList.add('hidden', 'd-none');
    let abaEmitidas = document.getElementById('navAbaFrentEmitidas'); if(abaEmitidas) abaEmitidas.classList.add('hidden', 'd-none');
    let abaExtras = document.getElementById('navAbaFrentExtras'); if(abaExtras) abaExtras.classList.add('hidden', 'd-none');

    const r = window.USUARIO.moduloRole;
    
    if(r === 'ADM') { 
        let vAdm = document.getElementById('viewADM');
        if(vAdm) {
            vAdm.classList.remove('hidden', 'd-none'); 
            vAdm.style.display = 'block';
        }
        if(window.filtrarRelatorio) window.filtrarRelatorio(); 
        
        setTimeout(() => {
            let abaDashboard = document.querySelector('[data-bs-target="#admDashboard"]');
            if (abaDashboard && typeof bootstrap !== 'undefined') {
                let tabObj = new bootstrap.Tab(abaDashboard);
                tabObj.show();
            }
        }, 150);
    }
    else if(r === 'Frentista') { 
        let vFrent = document.getElementById('viewFrentista');
        if(vFrent) { vFrent.classList.remove('hidden', 'd-none'); vFrent.style.display = 'block'; }
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'GerentePosto') { 
        let vFrent = document.getElementById('viewFrentista');
        if(vFrent) { vFrent.classList.remove('hidden', 'd-none'); vFrent.style.display = 'block'; }
        if(btnExtra) btnExtra.classList.remove('hidden', 'd-none');
        if(abaEmitidas) abaEmitidas.classList.remove('hidden', 'd-none'); 
        if(abaExtras) abaExtras.classList.remove('hidden', 'd-none');
        
        if(window.renderFilaPosto) window.renderFilaPosto(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas(); 
        if(window.renderRelatorioExtrasPosto) window.renderRelatorioExtrasPosto();
    }
    else if(r === 'GestorTransporte') { 
        let vTransp = document.getElementById('viewGestorTransp');
        if(vTransp) { vTransp.classList.remove('hidden', 'd-none'); vTransp.style.display = 'block'; }
        if(window.renderPainelTransporte) window.renderPainelTransporte(); 
    }
    else if(r === 'GestorAbastecimento') { 
        let vAbast = document.getElementById('viewGestorAbast');
        if(vAbast) { vAbast.classList.remove('hidden', 'd-none'); vAbast.style.display = 'block'; }
        if(window.renderPainelAbastecimento) window.renderPainelAbastecimento(); 
        if(window.renderGestaoNotas) window.renderGestaoNotas();
    }
    else if(r === 'LancadorRetroativo') {
        let vRetro = document.getElementById('viewRetroativo');
        if(vRetro) { vRetro.classList.remove('hidden', 'd-none'); vRetro.style.display = 'block'; }
        if(window.renderPainelRetroativo) window.renderPainelRetroativo();
    }
};

window.showView = function(viewId) {
    let targetId = `#${viewId}`;
    let abaLink = document.querySelector(`[data-bs-target="${targetId}"]`) || document.querySelector(`[data-bs-target="#${viewId}"]`);
    
    if (abaLink && typeof bootstrap !== 'undefined') {
        let tabObj = new bootstrap.Tab(abaLink);
        tabObj.show();
    } else {
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden', 'd-none');
            el.style.display = 'none';
        });
        const tela = document.getElementById('view-' + viewId); 
        if (tela) {
            tela.classList.remove('hidden', 'd-none');
            tela.style.display = 'block';
        }
    }
};

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
                
                if (!window.listenerUsuario) { 
                    window.listenerUsuario = onSnapshot(doc(db, "usuarios", window.USUARIO.cpf), (docSnap) => { 
                        if (!docSnap.exists() || docSnap.data().ativo === false) { 
                            alert("⚠️ Sessão encerrada."); 
                            window.logout(true); 
                        } 
                    }); 
                }
            }
            window.iniciarApp();
        } catch(e) {
            console.error("Falha na sessão:", e);
            if(loader) loader.classList.add('hidden', 'd-none');
            if(appView) appView.classList.add('hidden', 'd-none');
            if(loginView) loginView.classList.remove('hidden', 'd-none');
        }
    } else { 
        if(loader) loader.classList.add('hidden', 'd-none');
        if(appView) appView.classList.add('hidden', 'd-none');
        if(loginView) loginView.classList.remove('hidden', 'd-none');
    }
});