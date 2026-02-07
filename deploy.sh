#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  WarmPrompt v5.0 - Ubuntu 22 一键部署脚本
#  作者: Lokua
# ═══════════════════════════════════════════════════════════════

# ══════════════════════ 配置常量 ══════════════════════
DOWNLOAD_URL="https://github.com/lulokua/WarmPrompt/releases/download/v5.0/WarmPrompt_v5.0.zip"
DEFAULT_INSTALL_DIR="/opt/WarmPrompt"
CONF_DIR="/etc/warmprompt"
CONF_FILE="${CONF_DIR}/install.conf"
CRED_FILE="${CONF_DIR}/credentials.txt"
LOG_DIR="/var/log/warmprompt"
LOG_FILE="${LOG_DIR}/install.log"
NGINX_CONF_FILE="/etc/nginx/sites-available/warmprompt"
NGINX_LINK_FILE="/etc/nginx/sites-enabled/warmprompt"
NODE_MAJOR=20
MAIN_PORT=3000
MEDIA_PORT=4001

# ══════════════════════ 颜色定义 ══════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# 符号
SYM_OK="${GREEN}✔${NC}"
SYM_FAIL="${RED}✘${NC}"
SYM_ARROW="${CYAN}➜${NC}"
SYM_WARN="${YELLOW}⚠${NC}"
SYM_INFO="${BLUE}ℹ${NC}"
SYM_DOT="${DIM}·${NC}"

# Spinner 字符
SPINNER_CHARS=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# 全局变量
INSTALL_DIR=""
DOMAIN=""
SERVER_IP=""
BASE_URL=""
QQ_MUSIC_API=""
QQ_MUSIC_KEY=""
QQ_MUSIC_COOKIE=""
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL=""
DEEPSEEK_MODEL=""
MIMO_API_KEY=""
MIMO_BASE_URL=""
MIMO_MODEL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_SECRET_KEY=""
MEDIA_UPLOAD_TOKEN=""
DB_PASS_ADMINI=""
DB_PASS_MEANI=""
DB_PASS_LETTER=""
DB_PASS_FEEDBACK=""
SPIN_PID=""

# ══════════════════════ 信号处理 ══════════════════════
cleanup() {
    [[ -n "${SPIN_PID:-}" ]] && kill "$SPIN_PID" 2>/dev/null || true
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
    printf "\033[?25h" # 显示光标
    echo -e "\n\n  ${DIM}操作已取消 (◕‿◕)${NC}\n"
    exit 130
}
trap cleanup INT TERM

# ══════════════════════ 工具函数 ══════════════════════

# 打印分隔线
print_line() {
    echo -e "  ${DIM}$(printf '─%.0s' $(seq 1 55))${NC}"
}

# 打印标题
print_header() {
    echo ""
    print_line
    echo -e "  ${CYAN}${BOLD}$1${NC}"
    print_line
    echo ""
}

# 日志函数
log_info()  { echo -e "  ${SYM_INFO}  $1"; }
log_ok()    { echo -e "  ${SYM_OK}  $1"; }
log_fail()  { echo -e "  ${SYM_FAIL}  $1"; }
log_warn()  { echo -e "  ${SYM_WARN}  $1"; }
log_arrow() { echo -e "  ${SYM_ARROW}  $1"; }

# 写入日志文件
write_log() {
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# 生成随机字符串（纯字母数字，安全用于所有场景）
gen_random() {
    local length=${1:-16}
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length"
}

# 生成随机 hex token
gen_hex_token() {
    local length=${1:-64}
    tr -dc 'a-f0-9' < /dev/urandom | head -c "$length"
}

# 生成 Secret Key (格式: XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX)
gen_secret_key() {
    local p1 p2 p3
    p1=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 10)
    p2=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 10)
    p3=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 10)
    echo "${p1}-${p2}-${p3}"
}

# 获取服务器公网 IP
get_public_ip() {
    curl -s --max-time 5 ifconfig.me 2>/dev/null ||
    curl -s --max-time 5 api.ipify.org 2>/dev/null ||
    curl -s --max-time 5 icanhazip.com 2>/dev/null ||
    hostname -I 2>/dev/null | awk '{print $1}' ||
    echo "127.0.0.1"
}

# Spinner 启动
spin_start() {
    local msg="$1"
    printf "\033[?25l" # 隐藏光标
    (
        local i=0
        while true; do
            printf "\r  ${CYAN}%s${NC}  %s " "${SPINNER_CHARS[$i]}" "$msg"
            i=$(( (i + 1) % ${#SPINNER_CHARS[@]} ))
            sleep 0.1
        done
    ) &
    SPIN_PID=$!
    disown "$SPIN_PID" 2>/dev/null
}

# Spinner 停止
spin_stop() {
    local success="${1:-true}"
    local msg="${2:-}"
    if [[ -n "$SPIN_PID" ]]; then
        kill "$SPIN_PID" 2>/dev/null
        wait "$SPIN_PID" 2>/dev/null || true
        SPIN_PID=""
    fi
    printf "\r\033[K" # 清除当前行
    printf "\033[?25h" # 显示光标
    if [[ "$success" == "true" ]]; then
        [[ -n "$msg" ]] && log_ok "$msg"
    else
        [[ -n "$msg" ]] && log_fail "$msg"
    fi
}

# 执行命令并显示 spinner
run_with_spinner() {
    local msg="$1"
    shift
    spin_start "$msg"
    if eval "$@" >> "$LOG_FILE" 2>&1; then
        spin_stop true "${GREEN}${msg}${NC}"
        return 0
    else
        spin_stop false "${RED}${msg} - 失败${NC}"
        return 1
    fi
}

# ══════════════════════ Banner ══════════════════════
show_banner() {
    clear
    echo ""
    echo -e "${CYAN}${BOLD}"
    cat << 'BANNER'
        ██╗      ██████╗  ██╗  ██╗ ██╗   ██╗  █████╗
        ██║     ██╔═══██╗ ██║ ██╔╝ ██║   ██║ ██╔══██╗
        ██║     ██║   ██║ █████╔╝  ██║   ██║ ███████║
        ██║     ██║   ██║ ██╔═██╗  ██║   ██║ ██╔══██║
        ███████╗╚██████╔╝ ██║  ██╗ ╚██████╔╝ ██║  ██║
        ╚══════╝ ╚═════╝  ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═╝
BANNER
    echo -e "${NC}"
    echo -e "        ${MAGENTA}(◕‿◕✿)${NC}  ${WHITE}${BOLD}WarmPrompt v5.0${NC} ${DIM}部署工具${NC}  ${MAGENTA}(✿◕‿◕)${NC}"
    echo -e "        ${DIM}$(printf '─%.0s' $(seq 1 47))${NC}"
    echo ""
}

# ══════════════════════ 主菜单 ══════════════════════
show_menu() {
    echo -e "  ${WHITE}${BOLD}请选择操作:${NC}"
    echo ""
    echo -e "    ${CYAN}[1]${NC}  ${GREEN}安装${NC} WarmPrompt v5.0"
    echo -e "    ${CYAN}[2]${NC}  ${RED}卸载${NC} WarmPrompt v5.0"
    echo ""
    echo -e "    ${CYAN}[0]${NC}  ${DIM}退出${NC}"
    echo ""
    print_line
    echo ""
    echo -ne "  ${SYM_ARROW}  请输入选项 [0-2]: "
    read -r choice

    case "$choice" in
        1) do_install ;;
        2) do_uninstall ;;
        0)
            echo -e "\n  ${DIM}再见~ (◕‿◕✿)${NC}\n"
            exit 0
            ;;
        *)
            echo -e "\n  ${SYM_WARN}  无效选项，请重新选择\n"
            show_menu
            ;;
    esac
}

# ══════════════════════ 环境预检 ══════════════════════
pre_check() {
    print_header "环境预检"

    local errors=0

    # 检查 root
    if [[ $EUID -ne 0 ]]; then
        log_fail "请使用 ${BOLD}root${NC} 用户或 ${BOLD}sudo${NC} 执行此脚本"
        ((errors++))
    else
        log_ok "Root 权限"
    fi

    # 检查 Ubuntu 版本
    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        if [[ "$ID" == "ubuntu" ]]; then
            local ver_major
            ver_major=$(echo "$VERSION_ID" | cut -d. -f1)
            if [[ "$ver_major" -ge 22 ]]; then
                log_ok "Ubuntu ${VERSION_ID}"
            else
                log_fail "需要 Ubuntu 22 或更高版本（当前: ${VERSION_ID}）"
                ((errors++))
            fi
        else
            log_warn "非 Ubuntu 系统（${ID}），可能存在兼容问题"
        fi
    else
        log_warn "无法检测系统版本"
    fi

    # 检查磁盘空间
    local free_mb
    free_mb=$(df / --output=avail -BM | tail -1 | tr -d ' M')
    if [[ "$free_mb" -ge 2048 ]]; then
        log_ok "磁盘空间: ${free_mb}MB 可用"
    else
        log_fail "磁盘空间不足（需要至少 2GB，当前: ${free_mb}MB）"
        ((errors++))
    fi

    # 检查网络连接
    if ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
        log_ok "网络连接正常"
    else
        log_warn "无法 ping 通 8.8.8.8，可能影响下载"
    fi

    echo ""

    if [[ $errors -gt 0 ]]; then
        log_fail "预检发现 ${BOLD}${errors}${NC} 个问题，请先解决后再运行"
        exit 1
    fi

    log_ok "${GREEN}所有检查通过${NC}"
    echo ""
}

# ══════════════════════ 用户输入收集 ══════════════════════
collect_user_input() {
    print_header "配置信息"

    # ---- 安装目录 ----
    echo -e "  ${WHITE}${BOLD}安装目录${NC} ${DIM}(默认: ${DEFAULT_INSTALL_DIR})${NC}"
    echo -ne "  ${SYM_ARROW}  "
    read -r input_install_dir
    INSTALL_DIR="${input_install_dir:-$DEFAULT_INSTALL_DIR}"
    log_ok "安装目录: ${BOLD}${INSTALL_DIR}${NC}"
    echo ""

    # 检查目录是否已存在
    if [[ -d "$INSTALL_DIR" ]] && [[ -f "$CONF_FILE" ]]; then
        log_warn "检测到已有安装: ${BOLD}${INSTALL_DIR}${NC}"
        echo -ne "  ${SYM_ARROW}  是否覆盖安装? [y/N]: "
        read -r overwrite
        if [[ "${overwrite,,}" != "y" ]]; then
            echo -e "\n  ${DIM}安装已取消${NC}\n"
            exit 0
        fi
        echo ""
    fi

    # ---- 域名 ----
    SERVER_IP=$(get_public_ip)
    echo -e "  ${WHITE}${BOLD}域名配置${NC} ${DIM}(留空则使用 IP: ${SERVER_IP})${NC}"
    echo -ne "  ${SYM_ARROW}  域名: "
    read -r input_domain
    if [[ -n "$input_domain" ]]; then
        DOMAIN="$input_domain"
        BASE_URL="http://${DOMAIN}"
    else
        DOMAIN=""
        BASE_URL="http://${SERVER_IP}"
    fi
    log_ok "访问地址: ${BOLD}${BASE_URL}${NC}"
    echo ""

    # ---- QQ 音乐 API ----
    print_line
    echo -e "\n  ${WHITE}${BOLD}QQ 音乐 API 配置${NC} ${DIM}(全部留空则跳过)${NC}\n"
    echo -ne "  ${SYM_ARROW}  API 地址: "
    read -r QQ_MUSIC_API
    echo -ne "  ${SYM_ARROW}  API Key:  "
    read -r QQ_MUSIC_KEY
    echo -ne "  ${SYM_ARROW}  Cookie:   "
    read -r QQ_MUSIC_COOKIE
    if [[ -n "$QQ_MUSIC_API" ]]; then
        log_ok "QQ 音乐 API 已配置"
    else
        log_info "${DIM}QQ 音乐 API 已跳过${NC}"
    fi
    echo ""

    # ---- DeepSeek AI ----
    print_line
    echo -e "\n  ${WHITE}${BOLD}DeepSeek AI 配置${NC} ${DIM}(API Key 留空则跳过)${NC}\n"
    echo -ne "  ${SYM_ARROW}  API Key:  "
    read -r DEEPSEEK_API_KEY
    echo -ne "  ${SYM_ARROW}  Base URL ${DIM}(默认: https://api.deepseek.com)${NC}: "
    read -r DEEPSEEK_BASE_URL
    DEEPSEEK_BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com}"
    echo -ne "  ${SYM_ARROW}  Model ${DIM}(默认: deepseek-chat)${NC}: "
    read -r DEEPSEEK_MODEL
    DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek-chat}"
    if [[ -n "$DEEPSEEK_API_KEY" ]]; then
        log_ok "DeepSeek AI 已配置"
    else
        log_info "${DIM}DeepSeek AI 已跳过${NC}"
    fi
    echo ""

    # ---- MiMo AI ----
    print_line
    echo -e "\n  ${WHITE}${BOLD}MiMo AI 配置${NC} ${DIM}(API Key 留空则跳过)${NC}\n"
    echo -ne "  ${SYM_ARROW}  API Key:  "
    read -r MIMO_API_KEY
    echo -ne "  ${SYM_ARROW}  Base URL ${DIM}(默认: https://api.xiaomimimo.com)${NC}: "
    read -r MIMO_BASE_URL
    MIMO_BASE_URL="${MIMO_BASE_URL:-https://api.xiaomimimo.com}"
    echo -ne "  ${SYM_ARROW}  Model ${DIM}(默认: mimo-v2-flash)${NC}: "
    read -r MIMO_MODEL
    MIMO_MODEL="${MIMO_MODEL:-mimo-v2-flash}"
    if [[ -n "$MIMO_API_KEY" ]]; then
        log_ok "MiMo AI 已配置"
    else
        log_info "${DIM}MiMo AI 已跳过${NC}"
    fi
    echo ""

    # ---- 确认 ----
    print_line
    echo -e "\n  ${WHITE}${BOLD}配置确认${NC}\n"
    echo -e "  ${SYM_DOT}  安装目录:  ${BOLD}${INSTALL_DIR}${NC}"
    echo -e "  ${SYM_DOT}  访问地址:  ${BOLD}${BASE_URL}${NC}"
    echo -ne "  ${SYM_DOT}  QQ 音乐:   "
    [[ -n "$QQ_MUSIC_API" ]] && echo -e "${GREEN}已配置${NC}" || echo -e "${DIM}未配置${NC}"
    echo -ne "  ${SYM_DOT}  DeepSeek:  "
    [[ -n "$DEEPSEEK_API_KEY" ]] && echo -e "${GREEN}已配置${NC}" || echo -e "${DIM}未配置${NC}"
    echo -ne "  ${SYM_DOT}  MiMo:      "
    [[ -n "$MIMO_API_KEY" ]] && echo -e "${GREEN}已配置${NC}" || echo -e "${DIM}未配置${NC}"
    echo ""

    echo -ne "  ${SYM_ARROW}  确认开始安装? [Y/n]: "
    read -r confirm
    if [[ "${confirm,,}" == "n" ]]; then
        echo -e "\n  ${DIM}安装已取消${NC}\n"
        exit 0
    fi
}

# ══════════════════════ 下载项目 ══════════════════════
download_project() {
    print_header "下载项目"

    if [[ -z "$DOWNLOAD_URL" ]]; then
        log_fail "下载链接未配置！请在脚本顶部设置 ${BOLD}DOWNLOAD_URL${NC}"
        exit 1
    fi

    # 创建安装目录
    mkdir -p "$INSTALL_DIR"

    local tmp_file="/tmp/warmprompt_download.tmp"

    # 下载
    spin_start "正在下载 WarmPrompt v5.0 ..."
    if curl -fSL --progress-bar "$DOWNLOAD_URL" -o "$tmp_file" >> "$LOG_FILE" 2>&1; then
        spin_stop true "下载完成"
    else
        spin_stop false "下载失败，请检查链接是否正确"
        rm -f "$tmp_file"
        exit 1
    fi

    # 检测文件类型并解压
    spin_start "正在解压 ..."

    local file_type
    file_type=$(file -b "$tmp_file" 2>/dev/null || echo "unknown")

    if [[ "$file_type" == *"gzip"* ]] || [[ "$DOWNLOAD_URL" == *".tar.gz"* ]] || [[ "$DOWNLOAD_URL" == *".tgz"* ]]; then
        if tar -xzf "$tmp_file" -C "$INSTALL_DIR" --strip-components=1 >> "$LOG_FILE" 2>&1; then
            spin_stop true "解压完成 ${DIM}(tar.gz)${NC}"
        else
            spin_stop false "解压失败"
            rm -f "$tmp_file"
            exit 1
        fi
    elif [[ "$file_type" == *"Zip"* ]] || [[ "$DOWNLOAD_URL" == *".zip"* ]]; then
        # 确保 unzip 已安装
        command -v unzip &>/dev/null || apt-get install -y unzip >> "$LOG_FILE" 2>&1

        local tmp_extract="/tmp/warmprompt_extract_$$"
        rm -rf "$tmp_extract"
        mkdir -p "$tmp_extract"

        if unzip -q "$tmp_file" -d "$tmp_extract" >> "$LOG_FILE" 2>&1; then
            # 处理可能的嵌套目录
            local inner_dir
            inner_dir=$(find "$tmp_extract" -mindepth 1 -maxdepth 1 -type d | head -1)
            if [[ -n "$inner_dir" ]]; then
                cp -a "$inner_dir"/. "$INSTALL_DIR"/
            else
                cp -a "$tmp_extract"/. "$INSTALL_DIR"/
            fi
            spin_stop true "解压完成 ${DIM}(zip)${NC}"
        else
            spin_stop false "解压失败"
            rm -f "$tmp_file"
            rm -rf "$tmp_extract"
            exit 1
        fi
        rm -rf "$tmp_extract"
    else
        spin_stop false "未知的文件格式: ${file_type}"
        rm -f "$tmp_file"
        exit 1
    fi

    rm -f "$tmp_file"
    log_ok "项目已部署到 ${BOLD}${INSTALL_DIR}${NC}"
    echo ""
}

# ══════════════════════ 安装系统依赖 ══════════════════════
install_dependencies() {
    print_header "安装系统依赖"

    # 安装基础工具
    run_with_spinner "更新软件包列表" "apt-get update -y"
    echo ""

    # 确保 curl 可用
    if ! command -v curl &>/dev/null; then
        run_with_spinner "安装 curl" "apt-get install -y curl"
    fi

    # 状态目录
    local status_dir="/tmp/warmprompt_status_$$"
    rm -rf "$status_dir" && mkdir -p "$status_dir"

    # ---- 后台并行安装 ----

    # MySQL
    (
        echo "running" > "$status_dir/mysql"
        if dpkg -l 2>/dev/null | grep -q "ii  mysql-server "; then
            echo "skipped" > "$status_dir/mysql"
        else
            if DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server >> "$LOG_FILE" 2>&1; then
                systemctl enable mysql >> "$LOG_FILE" 2>&1
                systemctl start mysql >> "$LOG_FILE" 2>&1
                echo "done" > "$status_dir/mysql"
            else
                echo "failed" > "$status_dir/mysql"
            fi
        fi
    ) &
    local pid_mysql=$!

    # Nginx
    (
        echo "running" > "$status_dir/nginx"
        if dpkg -l 2>/dev/null | grep -q "ii  nginx "; then
            echo "skipped" > "$status_dir/nginx"
        else
            if DEBIAN_FRONTEND=noninteractive apt-get install -y nginx >> "$LOG_FILE" 2>&1; then
                systemctl enable nginx >> "$LOG_FILE" 2>&1
                echo "done" > "$status_dir/nginx"
            else
                echo "failed" > "$status_dir/nginx"
            fi
        fi
    ) &
    local pid_nginx=$!

    # Node.js
    (
        echo "running" > "$status_dir/nodejs"
        local current_ver
        current_ver=$(node --version 2>/dev/null | tr -d 'v' | cut -d. -f1)
        if [[ -n "$current_ver" ]] && [[ "$current_ver" -ge "$NODE_MAJOR" ]]; then
            echo "skipped" > "$status_dir/nodejs"
        else
            if curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >> "$LOG_FILE" 2>&1 && \
               DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs >> "$LOG_FILE" 2>&1; then
                echo "done" > "$status_dir/nodejs"
            else
                echo "failed" > "$status_dir/nodejs"
            fi
        fi
    ) &
    local pid_nodejs=$!

    # ---- 并行进度显示 ----
    printf "\033[?25l" # 隐藏光标

    local spin_idx=0
    local all_done=false
    local first_draw=true

    while ! $all_done; do
        local s_mysql s_nginx s_nodejs
        s_mysql=$(cat "$status_dir/mysql" 2>/dev/null || echo "running")
        s_nginx=$(cat "$status_dir/nginx" 2>/dev/null || echo "running")
        s_nodejs=$(cat "$status_dir/nodejs" 2>/dev/null || echo "running")

        local d_mysql d_nginx d_nodejs
        local sc="${SPINNER_CHARS[$spin_idx]}"

        # MySQL 状态行
        case "$s_mysql" in
            running)  d_mysql="  ${CYAN}${sc}${NC}  MySQL 8.0            ${DIM}安装中...${NC}     " ;;
            done)     d_mysql="  ${SYM_OK}  MySQL 8.0            ${GREEN}安装完成${NC}     " ;;
            skipped)  d_mysql="  ${SYM_OK}  MySQL 8.0            ${DIM}已存在，跳过${NC} " ;;
            failed)   d_mysql="  ${SYM_FAIL}  MySQL 8.0            ${RED}安装失败${NC}     " ;;
        esac

        # Nginx 状态行
        case "$s_nginx" in
            running)  d_nginx="  ${CYAN}${sc}${NC}  Nginx                ${DIM}安装中...${NC}     " ;;
            done)     d_nginx="  ${SYM_OK}  Nginx                ${GREEN}安装完成${NC}     " ;;
            skipped)  d_nginx="  ${SYM_OK}  Nginx                ${DIM}已存在，跳过${NC} " ;;
            failed)   d_nginx="  ${SYM_FAIL}  Nginx                ${RED}安装失败${NC}     " ;;
        esac

        # Node.js 状态行
        case "$s_nodejs" in
            running)  d_nodejs="  ${CYAN}${sc}${NC}  Node.js ${NODE_MAJOR}.x          ${DIM}安装中...${NC}     " ;;
            done)     d_nodejs="  ${SYM_OK}  Node.js ${NODE_MAJOR}.x          ${GREEN}安装完成${NC}     " ;;
            skipped)  d_nodejs="  ${SYM_OK}  Node.js ${NODE_MAJOR}.x          ${DIM}已存在，跳过${NC} " ;;
            failed)   d_nodejs="  ${SYM_FAIL}  Node.js ${NODE_MAJOR}.x          ${RED}安装失败${NC}     " ;;
        esac

        # 绘制
        if $first_draw; then
            first_draw=false
        else
            printf "\033[3A" # 上移 3 行
        fi

        echo -e "$d_mysql"
        echo -e "$d_nginx"
        echo -e "$d_nodejs"

        spin_idx=$(( (spin_idx + 1) % ${#SPINNER_CHARS[@]} ))

        # 全部完成?
        if [[ "$s_mysql" != "running" ]] && [[ "$s_nginx" != "running" ]] && [[ "$s_nodejs" != "running" ]]; then
            all_done=true
        else
            sleep 0.15
        fi
    done

    printf "\033[?25h" # 显示光标

    # 等待后台进程
    wait "$pid_mysql" 2>/dev/null || true
    wait "$pid_nginx" 2>/dev/null || true
    wait "$pid_nodejs" 2>/dev/null || true

    # 检查失败
    local s_mysql s_nginx s_nodejs
    s_mysql=$(cat "$status_dir/mysql" 2>/dev/null || echo "unknown")
    s_nginx=$(cat "$status_dir/nginx" 2>/dev/null || echo "unknown")
    s_nodejs=$(cat "$status_dir/nodejs" 2>/dev/null || echo "unknown")

    if [[ "$s_mysql" == "failed" ]] || [[ "$s_nginx" == "failed" ]] || [[ "$s_nodejs" == "failed" ]]; then
        echo ""
        log_fail "部分依赖安装失败，请查看日志: ${BOLD}${LOG_FILE}${NC}"
        exit 1
    fi

    # 安装 PM2
    echo ""
    run_with_spinner "安装 PM2 进程管理器" "npm install -g pm2"

    echo ""
    log_ok "${GREEN}所有依赖安装完成${NC}"
    echo ""

    # 清理
    rm -rf "$status_dir"
}

# ══════════════════════ 配置数据库 ══════════════════════
setup_databases() {
    print_header "配置数据库"

    # 生成随机密码
    DB_PASS_ADMINI=$(gen_random 16)
    DB_PASS_MEANI=$(gen_random 16)
    DB_PASS_LETTER=$(gen_random 16)
    DB_PASS_FEEDBACK=$(gen_random 16)

    # 创建数据库和用户
    local db_configs=(
        "admini:admini:${DB_PASS_ADMINI}"
        "meani:meani:${DB_PASS_MEANI}"
        "letter:letter:${DB_PASS_LETTER}"
        "feedback:feedback:${DB_PASS_FEEDBACK}"
    )

    for config in "${db_configs[@]}"; do
        IFS=':' read -r db_name db_user db_pass <<< "$config"

        spin_start "创建数据库 ${db_name} ..."

        mysql -e "CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >> "$LOG_FILE" 2>&1
        mysql -e "DROP USER IF EXISTS '${db_user}'@'localhost';" >> "$LOG_FILE" 2>&1
        mysql -e "CREATE USER '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';" >> "$LOG_FILE" 2>&1
        mysql -e "GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'localhost';" >> "$LOG_FILE" 2>&1
        mysql -e "FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1

        spin_stop true "数据库 ${BOLD}${db_name}${NC} ${DIM}(用户: ${db_user})${NC}"
    done

    echo ""

    # 导入表结构
    local sql_dir="${INSTALL_DIR}/sql"

    if [[ -d "$sql_dir" ]]; then
        log_info "导入表结构 ..."
        echo ""

        # admini <- accounts.sql
        if [[ -f "$sql_dir/accounts.sql" ]]; then
            run_with_spinner "导入 accounts + system_flags 表 → admini" \
                "mysql admini < '${sql_dir}/accounts.sql'"
        fi

        # meani <- gift_submissions.sql
        if [[ -f "$sql_dir/gift_submissions.sql" ]]; then
            run_with_spinner "导入 gift_submissions 表 → meani" \
                "mysql meani < '${sql_dir}/gift_submissions.sql'"
        fi

        # letter <- letter_submissions.sql
        if [[ -f "$sql_dir/letter_submissions.sql" ]]; then
            run_with_spinner "导入 letter_submissions 表 → letter" \
                "mysql letter < '${sql_dir}/letter_submissions.sql'"
        fi

        # feedback <- feedback_submissions.sql + feedback_comments.sql
        if [[ -f "$sql_dir/feedback_submissions.sql" ]]; then
            run_with_spinner "导入 feedback_submissions 表 → feedback" \
                "mysql feedback < '${sql_dir}/feedback_submissions.sql'"
        fi
        if [[ -f "$sql_dir/feedback_comments.sql" ]]; then
            run_with_spinner "导入 feedback_comments 相关表 → feedback" \
                "mysql feedback < '${sql_dir}/feedback_comments.sql'"
        fi
    else
        log_warn "SQL 目录未找到: ${sql_dir}"
    fi

    echo ""
    log_ok "${GREEN}数据库配置完成${NC}"
    echo ""
}

# ══════════════════════ 生成 .env 文件 ══════════════════════
generate_env() {
    print_header "生成配置文件"

    # 生成管理员凭据
    ADMIN_USERNAME="admin_$(gen_random 4)"
    ADMIN_PASSWORD=$(gen_random 20)
    ADMIN_SECRET_KEY=$(gen_secret_key)

    # 生成 Media Token
    MEDIA_UPLOAD_TOKEN=$(gen_hex_token 64)

    # ---- 写入根目录 .env ----
    cat > "${INSTALL_DIR}/.env" << ENVEOF
# AI 服务
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
DEEPSEEK_BASE_URL=${DEEPSEEK_BASE_URL}
DEEPSEEK_MODEL=${DEEPSEEK_MODEL}
DEEPSEEK_TEMPERATURE=1.3
MIMO_API_KEY=${MIMO_API_KEY}
MIMO_BASE_URL=${MIMO_BASE_URL}
MIMO_MODEL=${MIMO_MODEL}
MIMO_TEMPERATURE=0.7
MIMO_TOP_P=0.95
MIMO_MAX_TOKENS=512
MIMO_THINKING=disabled

# QQ 音乐 API 配置
QQ_MUSIC_API=${QQ_MUSIC_API}
QQ_MUSIC_KEY=${QQ_MUSIC_KEY}
QQ_MUSIC_COOKIE=${QQ_MUSIC_COOKIE}

# 管理员登录凭证 (区分大小写)
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SECRET_KEY=${ADMIN_SECRET_KEY}

# VIP 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=admini
DB_PASSWORD=${DB_PASS_ADMINI}
DB_NAME=admini

# 主要数据库
MAIN_DB_HOST=localhost
MAIN_DB_PORT=3306
MAIN_DB_USER=meani
MAIN_DB_PASSWORD=${DB_PASS_MEANI}
MAIN_DB_NAME=meani

# 图片配置
MEDIA_SERVER_UPLOAD_URL=${BASE_URL}/api/upload
MEDIA_UPLOAD_TOKEN=${MEDIA_UPLOAD_TOKEN}
MEDIA_UPLOAD_MAX_BYTES=1073741824

# 信封服务配置
LETTER_DB_HOST=localhost
LETTER_DB_PORT=3306
LETTER_DB_USER=letter
LETTER_DB_PASSWORD=${DB_PASS_LETTER}
LETTER_DB_NAME=letter

# 意见反馈数据库配置
FEEDBACK_DB_HOST=localhost
FEEDBACK_DB_PORT=3306
FEEDBACK_DB_USER=feedback
FEEDBACK_DB_PASSWORD=${DB_PASS_FEEDBACK}
FEEDBACK_DB_NAME=feedback
FEEDBACK_MAX_CONTENT=2000
FEEDBACK_MAX_COMMENT=500
ENVEOF

    log_ok "根目录 ${BOLD}.env${NC} 已生成"

    # ---- 写入 media_server/.env ----
    mkdir -p "${INSTALL_DIR}/media_server"

    cat > "${INSTALL_DIR}/media_server/.env" << MEDIAENVEOF
MEDIA_BASE_URL=${BASE_URL}/
MEDIA_UPLOAD_TOKEN=${MEDIA_UPLOAD_TOKEN}
MEDIA_MAX_IMAGE_BYTES=524288000
MEDIA_MAX_VIDEO_BYTES=1073741824

# 限流配置
MEDIA_UPLOAD_RATE_WINDOW_MS=600000
MEDIA_UPLOAD_RATE_MAX=20
MEDIA_UPLOAD_BAN_MS=600000
MEDIA_DOWNLOAD_RATE_WINDOW_MS=60000
MEDIA_DOWNLOAD_RATE_MAX=300
MEDIA_DOWNLOAD_BAN_MS=600000
MEDIAENVEOF

    log_ok "media_server ${BOLD}.env${NC} 已生成"
    echo ""
}

# ══════════════════════ 安装 Node.js 依赖 ══════════════════════
install_npm_deps() {
    print_header "安装 Node.js 依赖"

    # 主项目
    run_with_spinner "安装主项目依赖 (npm install)" \
        "cd '${INSTALL_DIR}' && npm install --production"

    # media_server
    run_with_spinner "安装 Media Server 依赖 (npm install)" \
        "cd '${INSTALL_DIR}/media_server' && npm install --production"

    echo ""
    log_ok "${GREEN}Node.js 依赖安装完成${NC}"
    echo ""
}

# ══════════════════════ 配置 Nginx ══════════════════════
setup_nginx() {
    print_header "配置 Nginx"

    local server_name
    if [[ -n "$DOMAIN" ]]; then
        server_name="$DOMAIN"
    else
        server_name="_"
    fi

    # 移除默认站点
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    # 写入 Nginx 配置
    cat > "$NGINX_CONF_FILE" << NGINXEOF
server {
    listen 80;
    server_name ${server_name};

    client_max_body_size 1100m;

    # Media Server 路由 (端口 ${MEDIA_PORT})
    location /api/upload {
        proxy_pass http://127.0.0.1:${MEDIA_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /api/delete {
        proxy_pass http://127.0.0.1:${MEDIA_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /media/ {
        proxy_pass http://127.0.0.1:${MEDIA_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Range \$http_range;
        proxy_set_header If-Range \$http_if_range;
        proxy_buffering off;
    }

    location /health {
        proxy_pass http://127.0.0.1:${MEDIA_PORT};
        proxy_http_version 1.1;
    }

    # 主应用 (端口 ${MAIN_PORT})
    location / {
        proxy_pass http://127.0.0.1:${MAIN_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

    log_ok "Nginx 配置已写入"

    # 创建软链接
    ln -sf "$NGINX_CONF_FILE" "$NGINX_LINK_FILE"

    # 测试配置
    if nginx -t >> "$LOG_FILE" 2>&1; then
        log_ok "Nginx 配置测试通过"
    else
        log_fail "Nginx 配置测试失败，请检查日志: ${BOLD}${LOG_FILE}${NC}"
        exit 1
    fi

    # 重载
    systemctl reload nginx >> "$LOG_FILE" 2>&1
    log_ok "Nginx 已重载"
    echo ""
}

# ══════════════════════ PM2 + Systemd ══════════════════════
setup_pm2() {
    print_header "配置进程管理"

    # 创建 media_server 上传目录
    mkdir -p "${INSTALL_DIR}/media_server/uploads/images"
    mkdir -p "${INSTALL_DIR}/media_server/uploads/videos"

    # 停止之前可能存在的进程
    pm2 delete warmprompt-main 2>/dev/null || true
    pm2 delete warmprompt-media 2>/dev/null || true

    # 启动主应用
    spin_start "启动主应用 ..."
    if (cd "$INSTALL_DIR" && pm2 start server.js --name "warmprompt-main") >> "$LOG_FILE" 2>&1; then
        spin_stop true "主应用已启动 ${DIM}(端口 ${MAIN_PORT})${NC}"
    else
        spin_stop false "主应用启动失败"
        exit 1
    fi

    # 启动 Media Server
    spin_start "启动 Media Server ..."
    if (cd "${INSTALL_DIR}/media_server" && pm2 start server.js --name "warmprompt-media") >> "$LOG_FILE" 2>&1; then
        spin_stop true "Media Server 已启动 ${DIM}(端口 ${MEDIA_PORT})${NC}"
    else
        spin_stop false "Media Server 启动失败"
        exit 1
    fi

    # 保存 PM2 进程列表
    echo ""
    run_with_spinner "保存 PM2 进程列表" "pm2 save"

    # 配置 Systemd 开机自启
    run_with_spinner "配置开机自启 (Systemd)" "pm2 startup systemd -u root --hp /root"

    echo ""
    log_ok "${GREEN}进程管理配置完成${NC}"
    echo ""
}

# ══════════════════════ 保存安装信息 ══════════════════════
save_install_config() {
    mkdir -p "$CONF_DIR"

    # 保存安装配置（供卸载使用）
    cat > "$CONF_FILE" << CONFEOF
INSTALL_DIR=${INSTALL_DIR}
DOMAIN=${DOMAIN}
SERVER_IP=${SERVER_IP}
BASE_URL=${BASE_URL}
DB_NAMES=admini,meani,letter,feedback
DB_USERS=admini,meani,letter,feedback
NGINX_CONF_FILE=${NGINX_CONF_FILE}
NGINX_LINK_FILE=${NGINX_LINK_FILE}
CONFEOF

    # 保存凭据（仅 root 可读）
    cat > "$CRED_FILE" << CREDEOF
══════════════════════════════════════════
  WarmPrompt v5.0 安装凭据
  生成时间: $(date '+%Y-%m-%d %H:%M:%S')
══════════════════════════════════════════

  管理员账号:    ${ADMIN_USERNAME}
  管理员密码:    ${ADMIN_PASSWORD}
  Secret Key:   ${ADMIN_SECRET_KEY}

  Media Token:  ${MEDIA_UPLOAD_TOKEN}

  数据库密码:
    admini:     ${DB_PASS_ADMINI}
    meani:      ${DB_PASS_MEANI}
    letter:     ${DB_PASS_LETTER}
    feedback:   ${DB_PASS_FEEDBACK}

  访问地址:     ${BASE_URL}
  管理后台:     ${BASE_URL}/admini

══════════════════════════════════════════
CREDEOF
    chmod 600 "$CRED_FILE"
}

# ══════════════════════ 安装完成摘要 ══════════════════════
show_summary() {
    echo ""
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║                                                          ║"
    echo "  ║          ✨  WarmPrompt v5.0 安装完成!  ✨               ║"
    echo "  ║                                                          ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "  ${WHITE}${BOLD}网站访问地址:${NC}"
    echo -e "  ${SYM_ARROW}  ${CYAN}${BOLD}${BASE_URL}${NC}"
    echo ""

    echo -e "  ${WHITE}${BOLD}管理员后台${NC} ${DIM}(可分发 VIP 账号密码):${NC}"
    echo -e "  ${SYM_ARROW}  ${CYAN}${BOLD}${BASE_URL}/admini${NC}"
    echo ""
    echo -e "     ${DIM}用户名:${NC}     ${YELLOW}${BOLD}${ADMIN_USERNAME}${NC}"
    echo -e "     ${DIM}密  码:${NC}     ${YELLOW}${BOLD}${ADMIN_PASSWORD}${NC}"
    echo -e "     ${DIM}Secret Key:${NC} ${YELLOW}${BOLD}${ADMIN_SECRET_KEY}${NC}"
    echo ""

    echo -e "  ${WHITE}${BOLD}Media Upload Token:${NC}"
    echo -e "  ${SYM_ARROW}  ${DIM}${MEDIA_UPLOAD_TOKEN}${NC}"
    echo ""

    echo -e "${GREEN}${BOLD}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║                                                          ║"
    echo -e "  ║    ${YELLOW}⚠  请妥善保存以上信息!${GREEN}${BOLD}                               ║"
    echo "  ║                                                          ║"
    echo -e "  ║    ${NC}${DIM}凭据已保存至: ${CRED_FILE}${GREEN}${BOLD}       ║"
    echo "  ║                                                          ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "  ${DIM}常用命令:${NC}"
    echo -e "  ${SYM_DOT}  查看状态:  ${BOLD}pm2 status${NC}"
    echo -e "  ${SYM_DOT}  查看日志:  ${BOLD}pm2 logs${NC}"
    echo -e "  ${SYM_DOT}  重启服务:  ${BOLD}pm2 restart all${NC}"
    echo -e "  ${SYM_DOT}  安装日志:  ${BOLD}${LOG_FILE}${NC}"
    echo ""
    echo -e "  ${MAGENTA}(◕‿◕✿)${NC} ${DIM}感谢使用 WarmPrompt!${NC}"
    echo ""
}

# ══════════════════════ 安装主流程 ══════════════════════
do_install() {
    pre_check
    collect_user_input

    # 初始化日志
    mkdir -p "$LOG_DIR"
    echo "=== WarmPrompt v5.0 安装日志 $(date '+%Y-%m-%d %H:%M:%S') ===" > "$LOG_FILE"

    download_project
    install_dependencies
    setup_databases
    generate_env
    install_npm_deps
    setup_nginx
    setup_pm2
    save_install_config
    show_summary
}

# ══════════════════════ 卸载流程 ══════════════════════
do_uninstall() {
    print_header "卸载 WarmPrompt v5.0"

    # 读取安装配置
    if [[ -f "$CONF_FILE" ]]; then
        # shellcheck source=/dev/null
        source "$CONF_FILE"
        log_info "找到安装记录: ${BOLD}${INSTALL_DIR}${NC}"
    else
        log_warn "未找到安装记录"
        echo -ne "  ${SYM_ARROW}  请输入安装目录 (默认: ${DEFAULT_INSTALL_DIR}): "
        read -r input_dir
        INSTALL_DIR="${input_dir:-$DEFAULT_INSTALL_DIR}"
    fi

    echo ""
    echo -e "  ${RED}${BOLD}⚠  警告: 此操作将删除所有数据，不可恢复!${NC}"
    echo ""
    echo -ne "  ${RED}➜${NC}  输入 ${BOLD}YES${NC} 确认卸载: "
    read -r confirm

    if [[ "$confirm" != "YES" ]]; then
        echo -e "\n  ${DIM}卸载已取消${NC}\n"
        return
    fi

    echo ""
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    [[ ! -f "$LOG_FILE" ]] && echo "=== 卸载日志 ===" > "$LOG_FILE"

    # ---- 停止 PM2 进程 ----
    if command -v pm2 &>/dev/null; then
        spin_start "停止 PM2 进程 ..."
        pm2 delete warmprompt-main >> "$LOG_FILE" 2>&1 || true
        pm2 delete warmprompt-media >> "$LOG_FILE" 2>&1 || true
        pm2 save --force >> "$LOG_FILE" 2>&1 || true
        spin_stop true "PM2 进程已停止"
    fi

    # ---- 移除 Systemd 服务 ----
    if systemctl is-enabled pm2-root &>/dev/null 2>&1; then
        spin_start "移除 Systemd 开机自启 ..."
        pm2 unstartup systemd >> "$LOG_FILE" 2>&1 || true
        spin_stop true "Systemd 服务已移除"
    fi

    # ---- 删除数据库 ----
    if command -v mysql &>/dev/null; then
        local dbs=("admini" "meani" "letter" "feedback")
        for db in "${dbs[@]}"; do
            spin_start "删除数据库 ${db} ..."
            mysql -e "DROP DATABASE IF EXISTS \`${db}\`;" >> "$LOG_FILE" 2>&1 || true
            mysql -e "DROP USER IF EXISTS '${db}'@'localhost';" >> "$LOG_FILE" 2>&1 || true
            spin_stop true "数据库 ${BOLD}${db}${NC} 已删除"
        done
        mysql -e "FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1 || true
    fi

    # ---- 移除 Nginx 配置 ----
    local nginx_conf="${NGINX_CONF_FILE:-/etc/nginx/sites-available/warmprompt}"
    local nginx_link="${NGINX_LINK_FILE:-/etc/nginx/sites-enabled/warmprompt}"

    if [[ -f "$nginx_conf" ]] || [[ -L "$nginx_link" ]]; then
        spin_start "移除 Nginx 配置 ..."
        rm -f "$nginx_link" 2>/dev/null || true
        rm -f "$nginx_conf" 2>/dev/null || true
        # 恢复默认站点
        if [[ -f /etc/nginx/sites-available/default ]]; then
            ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
        fi
        nginx -t >> "$LOG_FILE" 2>&1 && systemctl reload nginx >> "$LOG_FILE" 2>&1 || true
        spin_stop true "Nginx 配置已移除"
    fi

    # ---- 删除项目文件 ----
    if [[ -d "${INSTALL_DIR:-/nonexistent}" ]] && [[ "$INSTALL_DIR" != "/" ]]; then
        spin_start "删除项目文件 ..."
        rm -rf "$INSTALL_DIR"
        spin_stop true "项目文件已删除: ${BOLD}${INSTALL_DIR}${NC}"
    fi

    # ---- 删除配置目录 ----
    rm -rf "$CONF_DIR" 2>/dev/null || true

    echo ""
    log_ok "${GREEN}WarmPrompt v5.0 已完全卸载${NC}"
    echo ""

    # ---- 可选: 卸载软件 ----
    print_line
    echo -e "\n  ${WHITE}${BOLD}是否同时卸载以下软件?${NC}\n"

    echo -ne "  ${SYM_ARROW}  卸载 MySQL?   [y/N]: "
    read -r del_mysql
    echo -ne "  ${SYM_ARROW}  卸载 Nginx?   [y/N]: "
    read -r del_nginx
    echo -ne "  ${SYM_ARROW}  卸载 Node.js? [y/N]: "
    read -r del_nodejs
    echo -ne "  ${SYM_ARROW}  卸载 PM2?     [y/N]: "
    read -r del_pm2

    echo ""

    local did_remove=false

    if [[ "${del_mysql,,}" == "y" ]]; then
        run_with_spinner "卸载 MySQL" "DEBIAN_FRONTEND=noninteractive apt-get purge -y mysql-server mysql-client mysql-common"
        run_with_spinner "清理 MySQL 数据" "rm -rf /var/lib/mysql /etc/mysql"
        did_remove=true
    fi

    if [[ "${del_nginx,,}" == "y" ]]; then
        run_with_spinner "卸载 Nginx" "DEBIAN_FRONTEND=noninteractive apt-get purge -y nginx nginx-common"
        did_remove=true
    fi

    if [[ "${del_pm2,,}" == "y" ]]; then
        run_with_spinner "卸载 PM2" "npm uninstall -g pm2"
        did_remove=true
    fi

    if [[ "${del_nodejs,,}" == "y" ]]; then
        run_with_spinner "卸载 Node.js" "DEBIAN_FRONTEND=noninteractive apt-get purge -y nodejs"
        did_remove=true
    fi

    if $did_remove; then
        run_with_spinner "清理残余依赖" "apt-get autoremove -y"
    fi

    # 清理日志
    rm -rf "$LOG_DIR" 2>/dev/null || true

    echo ""
    log_ok "${GREEN}卸载完成${NC}"
    echo -e "\n  ${DIM}再见~ (◕‿◕✿)${NC}\n"
}

# ══════════════════════ 入口 ══════════════════════
main() {
    show_banner
    show_menu
}

main "$@"
