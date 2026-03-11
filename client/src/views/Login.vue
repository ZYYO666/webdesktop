<template>
  <div class="min-h-[100dvh] w-full bg-cover bg-center bg-no-repeat relative overflow-y-auto overscroll-contain font-sans flex flex-col"
       :style="{ backgroundImage: currentWallpaperKind === 'image' && currentWallpaperUrl ? `url('${currentWallpaperUrl}')` : 'none', backgroundColor: '#2d2d2d' }">
    <video
      v-if="currentWallpaperKind === 'video' && currentWallpaperUrl"
      class="absolute inset-0 w-full h-full object-cover"
      :src="currentWallpaperUrl"
      autoplay
      loop
      muted
      playsinline
    ></video>
    <div class="absolute inset-0 bg-black/10"></div>

    <div class="relative z-10 pt-8 sm:pt-10 flex flex-col items-center text-center select-none pointer-events-none">
      <div class="text-white/90 font-light tracking-[0.2em] drop-shadow-2xl text-[56px] sm:text-[78px] leading-[1]">
        {{ formattedTime }}
      </div>
      <div class="mt-2 text-white/70 font-medium tracking-[0.18em] uppercase text-[14px] sm:text-[18px] drop-shadow-xl">
        {{ formattedDate }}
      </div>
    </div>

    <div class="relative z-10 flex justify-center mt-auto py-8 sm:pb-10 pb-safe">
      <div class="w-full max-w-[280px] flex flex-col items-center animate-fade-in-up">
        <div class="w-[45px] h-[45px] rounded-full bg-gray-500/30 backdrop-blur-md flex items-center justify-center mb-5 shadow-lg border border-white/20 overflow-hidden">
          <img v-if="userAvatar" :src="userAvatar" alt="User" class="w-full h-full object-cover" />
          <n-icon v-else :size="20" class="text-white/80">
            <User />
          </n-icon>
        </div>

        <form @submit.prevent="handleEnter" class="w-full px-4 relative h-[42px]">
          <TransitionGroup name="fade-slide">
            <div v-if="currentStep === 'username'" key="username" class="absolute inset-x-4 top-0">
              <div class="relative group">
                <input 
                  v-model="username"
                  type="text" 
                  :placeholder="`用户名`"
                  class="w-full px-4 py-2 bg-white/20 hover:bg-white/25 focus:bg-white/20 text-white placeholder-gray-300/70 rounded-full outline-none transition-all backdrop-blur-md text-center shadow-lg text-sm font-medium drop-shadow-md"
                  required
                  autofocus
                  @keydown.enter.prevent="nextStep"
                />
                <button 
                  type="button"
                  @click="nextStep"
                  class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  :disabled="!username?.trim?.()"
                  :class="username?.trim?.() ? 'opacity-100' : 'opacity-30 cursor-not-allowed pointer-events-none'"
                >
                  <n-icon :size="16"><ArrowRight /></n-icon>
                </button>
              </div>
            </div>

            <div v-if="currentStep === 'password'" key="password" class="absolute inset-x-4 top-0">
              <div class="relative group">
                <div class="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                  <button 
                    type="button"
                    @click="prevStep"
                    class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    title="返回"
                  >
                    <n-icon :size="14"><ArrowLeft /></n-icon>
                  </button>
                </div>
                <input 
                  v-model="password"
                  type="password" 
                  :placeholder="`密码`"
                  class="w-full px-10 py-2 bg-white/20 hover:bg-white/25 focus:bg-white/20 text-white placeholder-gray-300/70 rounded-full outline-none transition-all backdrop-blur-md text-center shadow-lg text-sm font-medium tracking-widest drop-shadow-md"
                  required
                  ref="passwordInput"
                  @keydown.enter.prevent="handlePasswordEnter"
                />
                <div v-if='loading' class="absolute right-3 top-1/2 -translate-y-1/2">
                  <n-spin size="small" stroke="white" />
                </div>
                <button 
                  v-else
                  type="button"
                  @click="handlePasswordEnter"
                  class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  :disabled="!password"
                  :class="password ? 'opacity-100' : 'opacity-30 cursor-not-allowed pointer-events-none'"
                >
                  <n-icon :size="16"><ArrowRight /></n-icon>
                </button>
              </div>
            </div>

            <div v-if="currentStep === 'confirm'" key="confirm" class="absolute inset-x-4 top-0">
              <div class="relative group">
                <div class="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                  <button 
                    type="button"
                    @click="prevStep"
                    class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  >
                    <n-icon :size="14"><ArrowLeft /></n-icon>
                  </button>
                </div>
                <input 
                  v-model="confirmPassword"
                  type="password" 
                  :placeholder="'确认密码'"
                  class="w-full px-10 py-2 bg-white/20 hover:bg-white/25 focus:bg-white/20 text-white placeholder-gray-300/70 rounded-full outline-none transition-all backdrop-blur-md text-center shadow-lg text-sm font-medium tracking-widest drop-shadow-md"
                  required
                  ref="confirmInput"
                />
                <div v-if='loading' class="absolute right-3 top-1/2 -translate-y-1/2">
                  <n-spin size="small" stroke="white" />
                </div>
                <button 
                  v-else
                  type="button"
                  @click="handleSubmit"
                  class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  :disabled="!confirmPassword"
                  :class="confirmPassword ? 'opacity-100' : 'opacity-30 cursor-not-allowed pointer-events-none'"
                >
                  <n-icon :size="16"><ArrowRight /></n-icon>
                </button>
              </div>
            </div>
          </TransitionGroup>
        </form>

        <div class="mt-6 text-center">
          <button 
            @click="toggleMode" 
            class="text-[11px] text-white/50 hover:text-white/90 font-medium transition-colors drop-shadow-md tracking-wide"
          >
            {{ isRegistering ? '已有账号？去登录' : '没有账号？去注册' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { User, ArrowRight, ArrowLeft } from 'lucide-vue-next';
import { NIcon, NSpin } from 'naive-ui';
import { useAuthStore } from '../os/store/auth';
import { useSystemStore } from '../os/store/system';
import { uiModule } from '../os/ui';

const router = useRouter();
const { toast } = uiModule;

const authStore = useAuthStore();
const systemStore = useSystemStore();
const { currentWallpaperUrl, currentWallpaperKind } = storeToRefs(systemStore);
const { fetchSiteInfo } = systemStore;

const isRegistering = ref(false);
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const userAvatar = ref('');
const locale = ref(undefined);

// Steps: 'username' -> 'password' -> 'confirm' (register only)
const currentStep = ref('username');
const passwordInput = ref(null);
const confirmInput = ref(null);

const now = ref(new Date());
const formattedTime = computed(() => {
  const safeLocale = locale.value || undefined;
  return new Intl.DateTimeFormat(safeLocale, { hour: '2-digit', minute: '2-digit' }).format(now.value);
});
const formattedDate = computed(() => {
  const safeLocale = locale.value || undefined;
  return new Intl.DateTimeFormat(safeLocale, { weekday: 'long', month: 'long', day: 'numeric' }).format(now.value);
});

let clockTimerId = null;

onMounted(async () => {
    clockTimerId = window.setInterval(() => {
      now.value = new Date();
    }, 1000);

    const expired = sessionStorage.getItem('auth_expired');
    if (expired) {
        sessionStorage.removeItem('auth_expired');
        toast.warning('登录已过期，请重新登录');
    }

    // Check if there's a last logged in user
    const lastUser = localStorage.getItem('last_username');
    if (lastUser) {
        username.value = lastUser;
        currentStep.value = 'password';
    }
});

onBeforeUnmount(() => {
  if (clockTimerId) window.clearInterval(clockTimerId);
});

const toggleMode = () => {
    isRegistering.value = !isRegistering.value;
    password.value = '';
    confirmPassword.value = '';
    
    if (isRegistering.value) {
       currentStep.value = 'username';
       username.value = '';
    } else {
       const lastUser = localStorage.getItem('last_username');
       if (lastUser) {
           username.value = lastUser;
           currentStep.value = 'password';
       } else {
           currentStep.value = 'username';
       }
    }
};

const nextStep = () => {
    if (currentStep.value === 'username') {
        if (!username.value.trim()) return;
        currentStep.value = 'password';
        nextTick(() => {
            passwordInput.value?.focus();
        });
    } else if (currentStep.value === 'password') {
        if (!password.value) return;
        if (isRegistering.value) {
            currentStep.value = 'confirm';
             nextTick(() => {
                confirmInput.value?.focus();
            });
        } else {
            handleSubmit();
        }
    }
};

const prevStep = () => {
    if (currentStep.value === 'password') {
        currentStep.value = 'username';
        password.value = '';
    } else if (currentStep.value === 'confirm') {
        currentStep.value = 'password';
        confirmPassword.value = '';
        nextTick(() => {
            passwordInput.value?.focus();
        });
    }
};

const handlePasswordEnter = () => {
    if (isRegistering.value) {
        nextStep();
    } else {
        handleSubmit();
    }
};

const handleEnter = () => {
    if (currentStep.value === 'confirm') {
        handleSubmit();
    }
};

const handleSubmit = async () => {
  loading.value = true;
  try {
    if (isRegistering.value) {
      if (password.value !== confirmPassword.value) {
        toast.error('两次输入的密码不一致');
        return;
      }
      await authStore.register(username.value, password.value);
      toast.success('注册成功，请登录');
      isRegistering.value = false;
      currentStep.value = 'username'; // Reset to login flow
      password.value = '';
      confirmPassword.value = '';
    } else {
      await authStore.login(username.value, password.value);
      localStorage.setItem('last_username', username.value);
      
      // Ensure settings are loaded
      await fetchSiteInfo();
      
      // Redirect
      router.push('/');
    }
  } catch (err) {
    toast.error(err.message || '登录失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

input[type='password']::-ms-reveal,
input[type='password']::-ms-clear {
  display: none;
}

input[type='password']::-webkit-credentials-auto-fill-button {
  visibility: hidden;
  display: none !important;
  pointer-events: none;
}

input[type='password'] {
  appearance: none;
  -webkit-appearance: none;
}

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus,
select:-webkit-autofill,
select:-webkit-autofill:hover,
select:-webkit-autofill:focus {
  -webkit-text-fill-color: rgba(255, 255, 255, 0.95);
  caret-color: rgba(255, 255, 255, 0.95);
  transition: background-color 9999s ease-out, color 9999s ease-out;
  -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.2) inset;
  box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.2) inset;
}
</style>
