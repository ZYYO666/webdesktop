<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
      <div class="max-w-[880px] mx-auto space-y-6 md:space-y-8">

        <!-- General Settings -->
        <n-card :title="`常规设置`" :bordered="false" size="small">
          <n-form label-placement="top" class="space-y-4">
            <n-form-item :label="`网站标题`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `网站标题` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `设置网站的显示标题` }}</span>
                </div>
              </template>
              <n-input 
                v-model:value="settings.title" 
                :placeholder="`网站标题`"
                :disabled="!auth.hasRole('admin')"
              />
            </n-form-item>

            <n-form-item :label="`显示隐藏文件`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `显示隐藏文件` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `在文件浏览器中显示以点开头的文件` }}</span>
                </div>
              </template>
              <n-switch v-model:value="settings.showDotfiles" />
            </n-form-item>

            <n-form-item v-if="auth.hasRole('admin')" :label="`允许注册`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `允许注册` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `允许新用户注册账号` }}</span>
                </div>
              </template>
              <n-switch v-model:value="settings.allowRegistration" />
            </n-form-item>

            <n-form-item v-if="auth.hasRole('admin')" :label="`允许普通用户登录`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `允许普通用户登录` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `允许非管理员用户登录系统` }}</span>
                </div>
              </template>
              <n-switch v-model:value="settings.allowNonAdminLogin" />
            </n-form-item>

            <n-form-item v-if="auth.hasRole('admin')" :label="`启用 SSO`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `启用 SSO` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `启用单点登录功能` }}</span>
                </div>
              </template>
              <n-switch v-model:value="settings.enableSso" />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- System Maintenance -->
        <n-card :title="`系统维护`" :bordered="false" size="small" v-if="auth.hasRole('admin')">
          <n-form label-placement="top">
            <n-form-item :label="`清理缓存`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `清理缓存` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `清理系统缓存文件` }}</span>
                </div>
              </template>
              <n-button type='warning' ghost @click="handleClearCache" :loading="clearingCache">
                {{ `清理缓存` }}
              </n-button>
            </n-form-item>
          </n-form>
        </n-card>
        
        <!-- Gallery Settings -->
        <n-card :title="`图库设置`" :bordered="false" size="small">
          <n-form label-placement="top">
            <n-form-item :label="`缩略图质量`">
              <template #label>
                <div class="flex flex-col gap-1">
                  <span>{{ `缩略图质量` }}</span>
                  <span class="text-xs text-gray-500 font-normal">{{ `设置生成的缩略图质量 (10-100)` }}</span>
                </div>
              </template>
              <div class="w-full flex items-center gap-4">
                <n-slider 
                  v-model:value="settings.thumbnailQuality" 
                  :min="10" 
                  :max="100" 
                  class="flex-1"
                />
                <span class="w-12 text-sm text-gray-700 font-medium text-right">{{ settings.thumbnailQuality }}%</span>
              </div>
            </n-form-item>
          </n-form>
        </n-card>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch, nextTick } from 'vue';
import { useOs } from '@/os';

const os = useOs();
const api = os.api;

const toast = os.ui.toast;
const auth = os.stores.auth;

const { requestSiteInfoRefresh } = os.stores.system;
const saving = ref(false);
const loading = ref(true);
const clearingCache = ref(false);
const applyingServerState = ref(false);
let saveSeq = 0;

const settings = reactive({
  title: '',
  thumbnailQuality: 90,
  defaultLanguage: 'zh',
  showDotfiles: false,
  allowRegistration: true,
  allowNonAdminLogin: true,
  enableSso: false
});

const applyServerSettings = async (data) => {
  if (!data) return;
  applyingServerState.value = true;
  if (data.title !== undefined) settings.title = data.title || '';
  if (data.thumbnailQuality !== undefined) settings.thumbnailQuality = parseInt(data.thumbnailQuality);
  if (data.showDotfiles !== undefined) settings.showDotfiles = data.showDotfiles === 'true';
  if (data.allowRegistration !== undefined) settings.allowRegistration = data.allowRegistration === 'true';
  if (data.allowNonAdminLogin !== undefined) settings.allowNonAdminLogin = data.allowNonAdminLogin === 'true';
  if (data.enableSso !== undefined) settings.enableSso = data.enableSso === 'true';
  await nextTick();
  applyingServerState.value = false;
};

const buildSaveEntries = () => {
  const entries = {
    thumbnailQuality: String(settings.thumbnailQuality),
    showDotfiles: String(settings.showDotfiles),
  };

  if (auth.hasRole('admin')) {
    entries.title = settings.title;
    entries.allowRegistration = String(settings.allowRegistration);
    entries.allowNonAdminLogin = String(settings.allowNonAdminLogin);
    entries.enableSso = String(settings.enableSso);
  }

  return entries;
};

const serverMatchesDesired = (serverData, desiredEntries) => {
  if (!serverData || typeof serverData !== 'object') return false;
  return Object.entries(desiredEntries || {}).every(([key, desiredVal]) => {
    if (serverData[key] === undefined) return true;
    return String(serverData[key]) === String(desiredVal);
  });
};

onMounted(async () => {
  try {
    const data = await api.getSettings();
    await applyServerSettings(data);
  } catch (err) {
    toast.error(`获取设置失败`);
  } finally {
    loading.value = false;
  }
});

const handleClearCache = async () => {
  clearingCache.value = true;
  try {
    await api.clearCache();
    toast.success('缓存已清理');
  } catch (e) {
    toast.error(e?.message || '清理缓存失败');
  } finally {
    clearingCache.value = false;
  }
};

const saveSettingsBatch = async (entries, options = {}) => {
  const pairs = Array.isArray(entries) ? entries : Object.entries(entries || {});

  try {
    let firstError = null;
    for (const [key, value] of pairs) {
      try {
        await api.saveSettings(key, value);
      } catch (e) {
        if (!firstError) firstError = e;
      }
    }
    if (firstError) throw firstError;
    if (options?.successMessage !== false && options?.successMessage) toast.success(String(options.successMessage));
    return true;
  } catch (e) {
    if (options?.errorMessage !== false && options?.errorMessage) toast.error(String(options.errorMessage));
    else if (options?.errorMessage !== false) toast.error(e?.message || '保存设置失败');
    return false;
  }
};

const saveAllSettings = async () => {
  const seq = ++saveSeq;
  saving.value = true;
  const prev = JSON.parse(JSON.stringify(settings));
  const desiredEntries = buildSaveEntries();
  try {
    const ok = await saveSettingsBatch(desiredEntries, { successMessage: false, errorMessage: false });
    if (seq !== saveSeq) return;
    if (!ok) throw new Error('save failed');

    requestSiteInfoRefresh();
    
    toast.success(`设置已保存`);
  } catch (err) {
    if (seq !== saveSeq) return;
    const serverData = await api.getSettings();
    if (seq !== saveSeq) return;

    if (serverMatchesDesired(serverData, desiredEntries)) {
      requestSiteInfoRefresh();
      toast.success(`设置已保存`);
      return;
    }

    toast.error(`保存设置失败`);
    if (serverData) {
      await applyServerSettings(serverData);
      return;
    }

    applyingServerState.value = true;
    Object.assign(settings, prev);
    setTimeout(() => {
      applyingServerState.value = false;
    }, 0);
  } finally {
    if (seq === saveSeq) saving.value = false;
  }
};

let saveTimeout = null;
watch(settings, () => {
  if (loading.value || applyingServerState.value) return;
  
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveAllSettings();
  }, 1000);
}, { deep: true });
</script>
