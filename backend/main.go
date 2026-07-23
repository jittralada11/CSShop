package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

// กำหนดโครงสร้างข้อมูล user (ตรงกับ table user)
type User struct {
	UID      int    `json:"uid"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Image    string `json:"image"`
	Role     string `json:"role"`
	Created  string `json:"created_at"`
}

// โครงสร้างข้อมูล Game
type Game struct {
	GameID      int     `json:"game_id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	ReleaseDate string  `json:"release_date"`
	Sales       int     `json:"sales"`
	Price       float64 `json:"price"`
	Image       string  `json:"image"`
	TypeID      int     `json:"type_id"`
	TypeName    string  `json:"type_name,omitempty"`
}

// โครงสร้างข้อมูล Wallet และ Transaction
type Wallet struct {
	WalletID    int     `json:"wallet_id"`
	UID         int     `json:"uid"`
	Balance     float64 `json:"balance"`
	LastUpdated string  `json:"last_updated"`
}

type WalletTransaction struct {
	TransID     int     `json:"trans_id"`
	WalletID    int     `json:"wallet_id"`
	Amount      float64 `json:"amount"`
	TransType   string  `json:"trans_type"`
	Description string  `json:"description"`
	CreatedAt   string  `json:"created_at"`
	Username    string  `json:"username,omitempty"` // สำหรับหน้าแอดมิน
}

type UserWithWallet struct {
	UID           int     `json:"uid"`
	Username      string  `json:"username"`
	Email         string  `json:"email"`
	Image         string  `json:"image"`
	Role          string  `json:"role"`
	CreatedAt     string  `json:"created_at"`
	WalletBalance float64 `json:"walletBalance"`
}

type UpdateGameRequest struct {
	GameID      int     `json:"game_id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	TypeID      int     `json:"type_id"`
	Image       string  `json:"image"`
}

// โครงสร้างข้อมูล Promotion
type Promotion struct {
	PromoID     int     `json:"promo_id"`
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Type        string  `json:"type"` // "percent" หรือ "amount"
	Discount    float64 `json:"discount_value"`
	UsageLimit  int     `json:"usage_limit"`
	UsedCount   int     `json:"used_count"`
	StartDate   string  `json:"start_date"`
	ExpiryDate  string  `json:"expiry_date"`
	IsActive    bool    `json:"is_active"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

var db *sql.DB

func main() {
	// Connection string
	dsn := "66011212012:JittraladaDB2012@tcp(202.28.34.210:3309)/db66011212012"

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Cannot connect to database:", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatal("Cannot ping database:", err)
	}
	fmt.Println("✅ Connected to database successfully")

	// Router
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "CSShop Backend-API is running successfully! ")
	})
	mux.HandleFunc("/user", getUsers)
	mux.HandleFunc("/register", registerUser)
	mux.HandleFunc("/login", loginUser)
	mux.HandleFunc("/upload", uploadHandler)
	mux.HandleFunc("/update-profile", updateUser)
	mux.HandleFunc("/wallet/topup", topUpWallet)
	mux.HandleFunc("/wallet/transactions", getWalletTransactions)
	mux.HandleFunc("/wallet/balance", getWalletBalance)
	mux.HandleFunc("/wallet/purchase", purchaseGame)
	mux.HandleFunc("/admin/transactions", getAllWalletTransactions) // สำหรับแอดมินดูธุรกรรมทั้งหมด
	mux.HandleFunc("/users-with-wallet", getUsersWithWallet)

	// Game Routes
	mux.HandleFunc("/user/games", getUserGames)
	mux.HandleFunc("/upload/game", uploadGameImage)
	mux.HandleFunc("/games", getGames)          // ดึงเกมทั้งหมด
	mux.HandleFunc("/game-types", getGameTypes) // ดึงประเภทเกมทั้งหมด
	mux.HandleFunc("/game/", getGameByID)       // ดึงเกมตาม id
	mux.HandleFunc("/game/add", addGame)        // เพิ่มเกมใหม่
	mux.HandleFunc("/game/update", updateGame)  // แก้ไขข้อมูลเกม
	mux.HandleFunc("/game/delete/", deleteGame) // ลบเกม
	mux.HandleFunc("/games/top-sales", getTopSellingGames)

	// Promotion Routes (จัดการโค้ดส่วนลด)
	mux.HandleFunc("/promotions", getPromotions)           // ดึงโปรโมชั่นทั้งหมด
	mux.HandleFunc("/promotions/add", addPromotion)        // เพิ่มโปรโมชั่นใหม่
	mux.HandleFunc("/promotions/update", updatePromotion)  // แก้ไขโปรโมชั่น
	mux.HandleFunc("/promotions/delete/", deletePromotion) // ลบโปรโมชั่น
	mux.HandleFunc("/promotions/validate", ValidatePromotion)

	// ✅ Serve static files (รูป)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	// ✅ เปิด CORS ให้ Angular เรียกได้
	handler := enableCORS(mux)

	// หา IP ของเครื่อง
	ip := getLocalIP()
	url := fmt.Sprintf("http://%s:8080", ip)

	// เปิด browser อัตโนมัติ
	openBrowser(url)

	// run server
	fmt.Printf("🚀 Server started at %s\n", url)
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", handler))

	// Router Existing Routes...
	mux.HandleFunc("/user", getUsers)

	// ... (Routes อื่นๆ)

	// ✅ เพิ่ม Route สำหรับแสดงชื่อตารางทั้งหมด
	mux.HandleFunc("/tables", getTables)
	mux.HandleFunc("/reset-password", resetPassword)
}

// ✅ ฟังก์ชันเปิด CORS
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// handler ดึงข้อมูล user ทั้งหมด
func getUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT uid, username, email, IFNULL(image, ''), role, created_at FROM user")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.UID, &u.Username, &u.Email, &u.Image, &u.Role, &u.Created); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// หา IPv4 LAN จริง
func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost"
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ip := ipnet.IP.To4(); ip != nil {
				if ip[0] == 192 || ip[0] == 10 || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) {
					return ip.String()
				}
			}
		}
	}
	return "localhost"
}

// เปิด browser อัตโนมัติ
func openBrowser(url string) {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin": // MacOS
		cmd = "open"
		args = []string{url}
	default: // Linux
		cmd = "xdg-open"
		args = []string{url}
	}

	exec.Command(cmd, args...).Start()
}

// handler ลงทะเบียนผู้ใช้ใหม่
func registerUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var u struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Image    string `json:"image"` // ✅ URL ที่ส่งมาจาก Angular
		Role     string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// ตรวจสอบ email ซ้ำ
	var exists int
	err := db.QueryRow("SELECT COUNT(*) FROM user WHERE email = ?", u.Email).Scan(&exists)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		http.Error(w, "Email already exists", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ใช้ URL ที่ Angular ส่งมาเลย (ไม่อัปโหลดซ้ำ)
	imageURL := u.Image

	// INSERT ข้อมูลลงฐานข้อมูล
	stmt, err := db.Prepare("INSERT INTO user (username, email, password, image, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	res, err := stmt.Exec(u.Username, u.Email, string(hashedPassword), imageURL, u.Role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	lastID, _ := res.LastInsertId()

	// ✅ ส่งข้อมูลกลับไปที่ frontend
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "User registered successfully",
		"uid":       lastID,
		"username":  u.Username,
		"email":     u.Email,
		"role":      u.Role,
		"image":     imageURL,
		"createdAt": time.Now().Format("2006-01-02 15:04:05"),
	})
}

// handler สำหรับ login
func loginUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var hashedPassword, username, role, image, createdAt string
	var uid int

	// ✅ ดึง image และ created_at มาด้วย
	err := db.QueryRow("SELECT uid, username, password, role, IFNULL(image,''), created_at FROM user WHERE email = ?",
		input.Email).Scan(&uid, &username, &hashedPassword, &role, &image, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Email not found", http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// ตรวจสอบ password
	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(input.Password))
	if err != nil {
		http.Error(w, "Incorrect password", http.StatusUnauthorized)
		return
	}

	// ✅ ตอบกลับ JSON ครบทุกฟิลด์
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Login successful",
		"uid":       uid,
		"username":  username,
		"email":     input.Email,
		"role":      role,
		"image":     image,
		"createdAt": createdAt,
	})
}

// handler สำหรับอัปโหลดไฟล์
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// อนุญาตเฉพาะ POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// อ่านไฟล์จากฟอร์ม
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "ไม่พบไฟล์ในคำขอ", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// ✅ สร้าง Cloudinary instance
	cld, err := cloudinary.NewFromParams(
		"dvgxxafbb",                   // 👉 แทนด้วยชื่อ cloud ของคุณ
		"146741477549332",             // 👉 api key จาก dashboard
		"so_4ajw-nCCtJekaC7VAUAqySX4", // 👉 api secret จาก dashboard
	)

	if err != nil {
		http.Error(w, "Cloudinary init error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ อัปโหลดไฟล์ขึ้น Cloudinary
	ctx := context.Background()
	uploadResult, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
		Folder:   "users", // สร้างโฟลเดอร์ใน Cloudinary ชื่อ users
		PublicID: header.Filename,
	})
	if err != nil {
		http.Error(w, "Upload error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ส่ง URL กลับไปให้ Angular
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"path": uploadResult.SecureURL, // ✅ URL รูปจาก Cloudinary
	})
}

// ✅ Handler สำหรับอัปโหลดรูปเกมขึ้น Cloudinary
func uploadGameImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "ไม่พบไฟล์ในคำขอ", http.StatusBadRequest)
		return
	}
	defer file.Close()

	cld, err := cloudinary.NewFromParams(
		"dvgxxafbb",                   // Cloud name ของคุณ
		"146741477549332",             // API Key
		"so_4ajw-nCCtJekaC7VAUAqySX4", // API Secret
	)
	if err != nil {
		http.Error(w, "Cloudinary init error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ctx := context.Background()
	uploadResult, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
		Folder:   "games", // 📂 เก็บไว้ในโฟลเดอร์ games
		PublicID: header.Filename,
	})
	if err != nil {
		http.Error(w, "Upload error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"path": uploadResult.SecureURL, // ✅ ส่ง URL กลับไปให้ Angular
	})
}

// ✅ handler สำหรับอัปเดตข้อมูลผู้ใช้

func updateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// ✅ รองรับทั้ง profileImage และ image จาก Angular
	var u struct {
		UID          int    `json:"uid"`
		Username     string `json:"username"`
		Email        string `json:"email"`
		ProfileImage string `json:"profileImage"`
		Image        string `json:"image"`
	}

	// ✅ แปลง JSON ที่รับมาจาก Angular
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// ✅ กำหนดรูปที่จะอัปเดต (ถ้า profileImage ว่างแต่ image มี → ใช้ image)
	imageToUpdate := u.ProfileImage
	if imageToUpdate == "" && u.Image != "" {
		imageToUpdate = u.Image
	}

	// ✅ Debug log ฝั่ง backend (ดูได้จาก terminal)
	fmt.Printf("📩 อัปเดตผู้ใช้ UID=%d | image=%s\n", u.UID, imageToUpdate)

	// ✅ อัปเดตในฐานข้อมูล
	stmt, err := db.Prepare("UPDATE user SET username=?, email=?, image=? WHERE uid=?")
	if err != nil {
		http.Error(w, "Database prepare error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	_, err = stmt.Exec(u.Username, u.Email, imageToUpdate, u.UID)
	if err != nil {
		http.Error(w, "Database exec error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ดึงข้อมูลล่าสุดกลับมา
	var updatedUser User
	err = db.QueryRow(`
		SELECT uid, username, email, IFNULL(image,''), role, created_at
		FROM user
		WHERE uid = ?`, u.UID).Scan(
		&updatedUser.UID,
		&updatedUser.Username,
		&updatedUser.Email,
		&updatedUser.Image,
		&updatedUser.Role,
		&updatedUser.Created,
	)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ส่งข้อมูลใหม่กลับให้ Angular
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uid":          updatedUser.UID,
		"username":     updatedUser.Username,
		"email":        updatedUser.Email,
		"profileImage": updatedUser.Image, // คืนชื่อฟิลด์แบบเดียวกับ Angular
		"role":         updatedUser.Role,
		"createdAt":    updatedUser.Created,
	})
}

// handler Game all game
func getGames(w http.ResponseWriter, r *http.Request) {
	query := `
	SELECT g.game_id, g.name, g.description, g.release_date, g.sales, g.price, g.image,
	       g.type_id, gt.type_name
	FROM game g
	LEFT JOIN game_type gt ON g.type_id = gt.type_id
	ORDER BY g.game_id DESC;
	`
	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var games []Game
	for rows.Next() {
		var g Game
		if err := rows.Scan(&g.GameID, &g.Name, &g.Description, &g.ReleaseDate,
			&g.Sales, &g.Price, &g.Image, &g.TypeID, &g.TypeName); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		games = append(games, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(games)
}

// just game ID
func getGameByID(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/game/"):]
	if id == "" {
		http.Error(w, "Missing game ID", http.StatusBadRequest)
		return
	}

	var g Game
	query := `
	SELECT g.game_id, g.name, g.description, g.release_date, g.sales, g.price, g.image,
	       g.type_id, gt.type_name
	FROM game g
	LEFT JOIN game_type gt ON g.type_id = gt.type_id
	WHERE g.game_id = ?;
	`
	err := db.QueryRow(query, id).Scan(&g.GameID, &g.Name, &g.Description, &g.ReleaseDate,
		&g.Sales, &g.Price, &g.Image, &g.TypeID, &g.TypeName)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Game not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// game type
// ✅ Handler ดึงประเภทเกมทั้งหมด
func getGameTypes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := db.Query("SELECT type_id, type_name FROM game_type")
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var types []map[string]interface{}
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		types = append(types, map[string]interface{}{
			"id":   id,
			"name": name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(types)
}

// ✅ Handler ดึง 5 เกมขายดีที่สุด
// ✅ Handler: ดึง Top N เกมขายดีที่สุด พร้อมนับ rank จากยอดขาย
func getTopSellingGames(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// อ่าน limit จาก query เช่น /games/top-sales?limit=5
	limit := 5
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	// ✅ ดึงเกมจาก DB เรียงตามยอดขายมากไปน้อย
	query := `
		SELECT 
			g.game_id, g.name, g.description, g.release_date,
			g.sales, g.price, g.image, g.type_id, gt.type_name
		FROM game g
		LEFT JOIN game_type gt ON g.type_id = gt.type_id
		ORDER BY g.sales DESC
		LIMIT ?;
	`

	rows, err := db.Query(query, limit)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// ✅ เตรียม slice สำหรับเก็บผลลัพธ์
	var games []map[string]interface{}

	// ✅ ตัวแปรเก็บลำดับ rank เริ่มที่ 1
	rank := 1

	for rows.Next() {
		var g Game
		if err := rows.Scan(&g.GameID, &g.Name, &g.Description, &g.ReleaseDate,
			&g.Sales, &g.Price, &g.Image, &g.TypeID, &g.TypeName); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// ✅ เพิ่มข้อมูล rank ตามยอดขาย
		games = append(games, map[string]interface{}{
			"game_id":      g.GameID,
			"name":         g.Name,
			"description":  g.Description,
			"release_date": g.ReleaseDate,
			"sales":        g.Sales,
			"price":        g.Price,
			"image":        g.Image,
			"type_id":      g.TypeID,
			"type_name":    g.TypeName,
			"salesRank":    rank, // ← นับลำดับจากยอดขาย
		})

		rank++ // เพิ่มลำดับทีละ 1 ทุกเกม
	}

	// ✅ ส่งข้อมูลกลับในรูปแบบ JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(games)
}

// add game
func addGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var g Game
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		http.Error(w, "Invalid JSON body: "+err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Printf("🎮 เพิ่มเกมใหม่: %+v\n", g)

	stmt, err := db.Prepare(`
		INSERT INTO game (name, description, release_date, sales, price, image, type_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		http.Error(w, "Prepare statement error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	res, err := stmt.Exec(g.Name, g.Description, g.ReleaseDate, g.Sales, g.Price, g.Image, g.TypeID)
	if err != nil {
		http.Error(w, "Insert error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	lastID, err := res.LastInsertId()
	if err != nil {
		http.Error(w, "Cannot get last insert ID: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ดึงข้อมูลเกมที่เพิ่งเพิ่มจาก DB กลับมา
	var newGame Game
	query := `
		SELECT g.game_id, g.name, g.description, g.release_date, g.sales,
		       g.price, g.image, g.type_id, gt.type_name
		FROM game g
		LEFT JOIN game_type gt ON g.type_id = gt.type_id
		WHERE g.game_id = ?
	`
	err = db.QueryRow(query, lastID).Scan(
		&newGame.GameID, &newGame.Name, &newGame.Description,
		&newGame.ReleaseDate, &newGame.Sales, &newGame.Price,
		&newGame.Image, &newGame.TypeID, &newGame.TypeName,
	)
	if err != nil {
		http.Error(w, "Fetch new game error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("✅ เพิ่มเกมสำเร็จ ID=%d ชื่อ=%s\n", newGame.GameID, newGame.Name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newGame)
}

// update game
// ✅ update game (อัปเดตพร้อมส่งข้อมูลเกมกลับ)
func updateGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// ✅ Debug log
	fmt.Printf("🛠️ Update game ID=%d | name=%s | type_id=%d\n", req.GameID, req.Name, req.TypeID)

	// ✅ ตรวจสอบว่าเกมนี้มีอยู่จริงไหม
	var exists int
	err := db.QueryRow("SELECT COUNT(*) FROM game WHERE game_id = ?", req.GameID).Scan(&exists)
	if err != nil {
		http.Error(w, "Database check error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if exists == 0 {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// ✅ ถ้า image หรือ name ว่าง → ดึงค่าปัจจุบันมาใช้แทน
	var current Game
	err = db.QueryRow(`
		SELECT name, description, price, image, type_id
		FROM game WHERE game_id = ?`, req.GameID).
		Scan(&current.Name, &current.Description, &current.Price, &current.Image, &current.TypeID)
	if err != nil {
		http.Error(w, "Fetch current game error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ใช้ค่าปัจจุบันเป็น fallback
	if req.Name == "" {
		req.Name = current.Name
	}
	if req.Description == "" {
		req.Description = current.Description
	}
	if req.Price == 0 {
		req.Price = current.Price
	}
	if req.Image == "" {
		req.Image = current.Image
	}
	if req.TypeID == 0 {
		req.TypeID = current.TypeID
	}

	// ✅ อัปเดตข้อมูล
	stmt, err := db.Prepare(`
		UPDATE game
		SET name=?, description=?, price=?, image=?, type_id=?, release_date=release_date
		WHERE game_id=?
	`)
	if err != nil {
		http.Error(w, "Prepare error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	_, err = stmt.Exec(req.Name, req.Description, req.Price, req.Image, req.TypeID, req.GameID)
	if err != nil {
		http.Error(w, "Update error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ดึงข้อมูลใหม่หลังอัปเดตกลับไป
	var updated Game
	query := `
		SELECT g.game_id, g.name, g.description, g.release_date, g.sales,
		       g.price, g.image, g.type_id, gt.type_name
		FROM game g
		LEFT JOIN game_type gt ON g.type_id = gt.type_id
		WHERE g.game_id = ?
	`
	err = db.QueryRow(query, req.GameID).Scan(
		&updated.GameID, &updated.Name, &updated.Description, &updated.ReleaseDate,
		&updated.Sales, &updated.Price, &updated.Image, &updated.TypeID, &updated.TypeName,
	)
	if err != nil {
		http.Error(w, "Fetch updated game error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("✅ Updated game: %+v\n", updated)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// delete game
func deleteGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Path[len("/game/delete/"):]
	if id == "" {
		http.Error(w, "Missing game ID", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("DELETE FROM game WHERE game_id = ?", id)
	if err != nil {
		http.Error(w, "Delete error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Game deleted successfully"})
}

// ✅ handler เติมเงินเข้ากระเป๋า (เวอร์ชันปลอดภัย ป้องกัน Race Condition)
func topUpWallet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// ✅ รับข้อมูลจาก frontend
	var req struct {
		UID    int     `json:"uid"`
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// ✅ ตรวจสอบข้อมูลเบื้องต้น
	if req.Amount <= 0 {
		http.Error(w, "Invalid top-up amount", http.StatusBadRequest)
		return
	}

	// ✅ เริ่ม Transaction พร้อม Isolation สูงสุด
	tx, err := db.BeginTx(context.Background(), &sql.TxOptions{
		Isolation: sql.LevelSerializable, // ป้องกันการอ่าน/เขียนพร้อมกัน
	})
	if err != nil {
		http.Error(w, "Transaction start error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var walletID int
	var balance float64
	err = tx.QueryRow("SELECT wallet_id, balance FROM wallet WHERE uid = ? FOR UPDATE", req.UID).Scan(&walletID, &balance)

	if err == sql.ErrNoRows {
		// ✅ ถ้ายังไม่มี wallet → สร้างใหม่พร้อมยอดเริ่มต้น
		res, err := tx.Exec("INSERT INTO wallet (uid, balance) VALUES (?, ?)", req.UID, req.Amount)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Create wallet error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		lastID, _ := res.LastInsertId()
		walletID = int(lastID)
		balance = req.Amount
	} else if err != nil {
		tx.Rollback()
		http.Error(w, "Query wallet error: "+err.Error(), http.StatusInternalServerError)
		return
	} else {
		// ✅ ถ้ามีอยู่แล้ว → อัปเดตยอด (พร้อมล็อก row แล้ว)
		_, err = tx.Exec("UPDATE wallet SET balance = balance + ? WHERE wallet_id = ?", req.Amount, walletID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Update wallet error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// ดึงยอดล่าสุด (ตรวจสอบหลังอัปเดต)
		err = tx.QueryRow("SELECT balance FROM wallet WHERE wallet_id = ? FOR UPDATE", walletID).Scan(&balance)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Balance check error: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// ✅ บันทึกธุรกรรมการเติมเงิน
	_, err = tx.Exec(`
		INSERT INTO wallet_transaction (wallet_id, amount, trans_type, description)
		VALUES (?, ?, 'topup', ?)`,
		walletID, req.Amount, fmt.Sprintf("Top up %.2f THB", req.Amount))
	if err != nil {
		tx.Rollback()
		http.Error(w, "Insert transaction error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ Commit ทุกขั้นตอนพร้อมกัน
	if err := tx.Commit(); err != nil {
		http.Error(w, "Commit error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ตอบกลับข้อมูลหลังอัปเดตสำเร็จ
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Top-up successful",
		"uid":     req.UID,
		"balance": balance,
	})
}

// ✅ handler สำหรับแอดมิน ดูประวัติการเติมเงินทั้งหมด
// ✅ ดึงประวัติการทำรายการทั้งหมดของ user
func getWalletTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uid := r.URL.Query().Get("uid")
	if uid == "" {
		http.Error(w, "Missing uid", http.StatusBadRequest)
		return
	}

	query := `
		SELECT wt.trans_id, wt.amount, wt.trans_type, wt.description, wt.created_at
		FROM wallet_transaction wt
		JOIN wallet w ON wt.wallet_id = w.wallet_id
		WHERE w.uid = ?
		ORDER BY wt.created_at DESC;
	`

	rows, err := db.Query(query, uid)
	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Transaction struct {
		TransID     int     `json:"trans_id"`
		Amount      float64 `json:"amount"`
		Type        string  `json:"type"`
		Description string  `json:"description"`
		CreatedAt   string  `json:"createdAt"`
	}

	var transactions []Transaction
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.TransID, &t.Amount, &t.Type, &t.Description, &t.CreatedAt); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

	// ✅ ถ้าไม่มีข้อมูลเลย ให้ส่ง array ว่าง [] แทน null
	if len(transactions) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]Transaction{}) // ส่ง array ว่าง
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

// ✅ handler ดึงยอดคงเหลือของกระเป๋าเงิน
func getWalletBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uid := r.URL.Query().Get("uid")
	if uid == "" {
		http.Error(w, "Missing uid", http.StatusBadRequest)
		return
	}

	var balance float64
	err := db.QueryRow("SELECT IFNULL(balance, 0) FROM wallet WHERE uid = ?", uid).Scan(&balance)
	if err == sql.ErrNoRows {
		balance = 0
	} else if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uid":     uid,
		"balance": balance,
	})
}

// ✅ handler หักเงินเมื่อผู้ใช้ซื้อเกม (เวอร์ชันป้องกัน Race Condition)
func purchaseGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UID         int     `json:"uid"`
		GameID      int     `json:"game_id"`
		Amount      float64 `json:"amount"`
		Description string  `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Amount <= 0 {
		http.Error(w, "Invalid purchase amount", http.StatusBadRequest)
		return
	}

	// ✅ เริ่ม transaction เพื่อให้ทุกขั้นตอนเป็น atomic
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Cannot start transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			http.Error(w, "Transaction panic", http.StatusInternalServerError)
		}
	}()

	// ✅ ตรวจสอบว่า user เคยซื้อเกมนี้แล้วหรือยัง
	var exists int
	err = tx.QueryRow("SELECT COUNT(*) FROM user_game WHERE uid = ? AND game_id = ?", req.UID, req.GameID).Scan(&exists)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Error checking game ownership: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		tx.Rollback()
		http.Error(w, "You already own this game", http.StatusBadRequest)
		return
	}

	// ✅ ล็อกแถว wallet (FOR UPDATE) เพื่อป้องกันการแก้ไขพร้อมกัน
	var walletID int
	var balance float64
	err = tx.QueryRow("SELECT wallet_id, balance FROM wallet WHERE uid = ? FOR UPDATE", req.UID).Scan(&walletID, &balance)
	if err == sql.ErrNoRows {
		tx.Rollback()
		http.Error(w, "Wallet not found", http.StatusNotFound)
		return
	} else if err != nil {
		tx.Rollback()
		http.Error(w, "Error fetching wallet: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if balance < req.Amount {
		tx.Rollback()
		http.Error(w, "Insufficient balance", http.StatusBadRequest)
		return
	}

	// ✅ ล็อกเกมที่กำลังจะซื้อ เพื่อป้องกันยอดขายซ้ำ (อีกจุดสำคัญ)
	var currentSales int
	err = tx.QueryRow("SELECT sales FROM game WHERE game_id = ? FOR UPDATE", req.GameID).Scan(&currentSales)
	if err == sql.ErrNoRows {
		tx.Rollback()
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	} else if err != nil {
		tx.Rollback()
		http.Error(w, "Error fetching game info: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ หักเงินออกจาก wallet
	_, err = tx.Exec("UPDATE wallet SET balance = balance - ? WHERE wallet_id = ?", req.Amount, walletID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Error updating wallet: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ เพิ่ม transaction log
	_, err = tx.Exec(`
		INSERT INTO wallet_transaction (wallet_id, amount, trans_type, description)
		VALUES (?, ?, 'purchase', ?)`,
		walletID, req.Amount, req.Description)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Error inserting transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ บันทึกว่า user ซื้อเกมนี้แล้ว
	_, err = tx.Exec("INSERT INTO user_game (uid, game_id) VALUES (?, ?)", req.UID, req.GameID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Error inserting user_game: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ อัปเดตยอดขายเกม (เพิ่ม 1) — อยู่ใน transaction เดียวกัน
	_, err = tx.Exec("UPDATE game SET sales = sales + 1 WHERE game_id = ?", req.GameID)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Error updating game sales: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ Commit ทุกอย่างพร้อมกัน (atomic operation)
	if err := tx.Commit(); err != nil {
		http.Error(w, "Commit transaction error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// ✅ ดึงยอดคงเหลือล่าสุดกลับไป
	var newBalance float64
	db.QueryRow("SELECT balance FROM wallet WHERE wallet_id = ?", walletID).Scan(&newBalance)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Purchase successful",
		"uid":     req.UID,
		"game_id": req.GameID,
		"balance": newBalance,
	})
}

// ✅ handler ดึงเกมที่ user เคยซื้อ
func getUserGames(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uid := r.URL.Query().Get("uid")
	if uid == "" {
		http.Error(w, "Missing uid", http.StatusBadRequest)
		return
	}

	query := `
		SELECT g.game_id, g.name, g.image, g.price
		FROM user_game ug
		JOIN game g ON ug.game_id = g.game_id
		WHERE ug.uid = ?
	`
	rows, err := db.Query(query, uid)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var games []Game
	for rows.Next() {
		var g Game
		if err := rows.Scan(&g.GameID, &g.Name, &g.Image, &g.Price); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		games = append(games, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(games)
}

// ✅ handler สำหรับแอดมิน ดูธุรกรรมทั้งหมดของทุกผู้ใช้
func getAllWalletTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// สามารถกรองตาม uid ได้ เช่น /admin/transactions?uid=5
	uid := r.URL.Query().Get("uid")

	query := `
		SELECT wt.trans_id, u.username, wt.amount, wt.trans_type, wt.description, wt.created_at
		FROM wallet_transaction wt
		JOIN wallet w ON wt.wallet_id = w.wallet_id
		JOIN user u ON w.uid = u.uid
	`
	var rows *sql.Rows
	var err error

	if uid != "" {
		query += " WHERE u.uid = ? ORDER BY wt.created_at DESC"
		rows, err = db.Query(query, uid)
	} else {
		query += " ORDER BY wt.created_at DESC"
		rows, err = db.Query(query)
	}

	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type AdminTransaction struct {
		TransID     int     `json:"trans_id"`
		Username    string  `json:"username"`
		Amount      float64 `json:"amount"`
		Type        string  `json:"type"`
		Description string  `json:"description"`
		CreatedAt   string  `json:"created_at"`
	}

	var transactions []AdminTransaction
	for rows.Next() {
		var t AdminTransaction
		if err := rows.Scan(&t.TransID, &t.Username, &t.Amount, &t.Type, &t.Description, &t.CreatedAt); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

// ✅ handler ดึง user พร้อมยอดเงิน
func getUsersWithWallet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT u.uid, u.username, u.email, IFNULL(u.image, ''), u.role, u.created_at,
		       IFNULL(w.balance, 0)
		FROM user u
		LEFT JOIN wallet w ON u.uid = w.uid
		ORDER BY u.uid ASC;
	`

	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []UserWithWallet
	for rows.Next() {
		var u UserWithWallet
		if err := rows.Scan(
			&u.UID,
			&u.Username,
			&u.Email,
			&u.Image,
			&u.Role,
			&u.CreatedAt,
			&u.WalletBalance, // ✅ เปลี่ยนจาก &u.Balance เป็น &u.WalletBalance
		); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// ✅ ดึงโปรโมชั่นทั้งหมด
func getPromotions(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT promo_id, code, description, type, discount_value, usage_limit, used_count, start_date, expiry_date, is_active, created_at, updated_at FROM promotions ORDER BY promo_id DESC")
	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var promotions []Promotion
	for rows.Next() {
		var p Promotion
		if err := rows.Scan(&p.PromoID, &p.Code, &p.Description, &p.Type, &p.Discount,
			&p.UsageLimit, &p.UsedCount, &p.StartDate, &p.ExpiryDate, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		promotions = append(promotions, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(promotions)
}

// ✅ เพิ่มโปรโมชั่นใหม่
func addPromotion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p Promotion
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	var exists int
	err := db.QueryRow("SELECT COUNT(*) FROM promotions WHERE code = ?", p.Code).Scan(&exists)
	if err != nil {
		http.Error(w, "Check code error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		http.Error(w, "Promotion code already exists", http.StatusBadRequest)
		return
	}

	stmt, err := db.Prepare(`
		INSERT INTO promotions (code, description, type, discount_value, usage_limit, used_count, start_date, expiry_date, is_active)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
	`)
	if err != nil {
		http.Error(w, "Prepare error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	_, err = stmt.Exec(p.Code, p.Description, p.Type, p.Discount, p.UsageLimit, p.StartDate, p.ExpiryDate, p.IsActive)
	if err != nil {
		http.Error(w, "Insert error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Promotion added successfully"})
}

// ✅ อัปเดตโปรโมชั่น
func updatePromotion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p Promotion
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	stmt, err := db.Prepare(`
		UPDATE promotions 
		SET code=?, description=?, type=?, discount_value=?, usage_limit=?, start_date=?, expiry_date=?, is_active=? 
		WHERE promo_id=?
	`)
	if err != nil {
		http.Error(w, "Prepare error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()

	_, err = stmt.Exec(p.Code, p.Description, p.Type, p.Discount, p.UsageLimit, p.StartDate, p.ExpiryDate, p.IsActive, p.PromoID)
	if err != nil {
		http.Error(w, "Update error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Promotion updated successfully"})
}

// ✅ ลบโปรโมชั่น
func deletePromotion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Path[len("/promotions/delete/"):]
	if id == "" {
		http.Error(w, "Missing promotion ID", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("DELETE FROM promotions WHERE promo_id = ?", id)
	if err != nil {
		http.Error(w, "Delete error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Promotion deleted successfully"})
}

// ✅ POST /promotions/validate
func ValidatePromotion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Code   string `json:"code"`
		UserID int    `json:"user_id"` // ✅ เพิ่ม user_id มาจาก frontend
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"valid":false,"message":"Invalid request"}`, 400)
		return
	}

	var promo Promotion
	err := db.QueryRow(`
		SELECT promo_id, code, discount_value, type, usage_limit, used_count, is_active, expiry_date
		FROM promotions WHERE code = ?`, req.Code,
	).Scan(&promo.PromoID, &promo.Code, &promo.Discount, &promo.Type, &promo.UsageLimit,
		&promo.UsedCount, &promo.IsActive, &promo.ExpiryDate)

	if err != nil {
		http.Error(w, `{"valid":false,"message":"ไม่พบรหัสส่วนลดนี้"}`, 400)
		return
	}

	// ✅ แปลงวันที่จาก DATE → Time
	expiryTime, err := time.Parse("2006-01-02", promo.ExpiryDate)
	if err != nil {
		http.Error(w, `{"valid":false,"message":"รูปแบบวันที่ไม่ถูกต้อง"}`, 400)
		return
	}

	// ✅ ตรวจสอบวันหมดอายุและสถานะ
	if time.Now().After(expiryTime) || !promo.IsActive {
		http.Error(w, `{"valid":false,"message":"รหัสหมดอายุหรือไม่สามารถใช้ได้"}`, 400)
		return
	}

	// ✅ ตรวจสอบจำนวนการใช้
	if promo.UsedCount >= promo.UsageLimit {
		http.Error(w, `{"valid":false,"message":"รหัสนี้ถูกใช้ถึงขีดจำกัดแล้ว"}`, 400)
		return
	}

	// ✅ บันทึกว่าผู้ใช้คนนี้ใช้โค้ดนี้
	_, err = db.Exec(`
		INSERT INTO promotion_usage (promo_id, user_id)
		VALUES (?, ?)`,
		promo.PromoID, req.UserID,
	)
	if err != nil {
		http.Error(w, `{"valid":false,"message":"ไม่สามารถบันทึกการใช้โค้ดได้"}`, 500)
		return
	}

	// ✅ เพิ่มจำนวน used_count
	_, _ = db.Exec(`UPDATE promotions SET used_count = used_count + 1 WHERE promo_id = ?`, promo.PromoID)

	// ✅ ส่งข้อมูลกลับ
	response := map[string]interface{}{
		"valid":    true,
		"discount": promo.Discount,
		"message":  "รหัสส่วนลดใช้งานได้",
		"promo":    promo,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handler ดึงรายชื่อตารางทั้งหมดในฐานข้อมูล
func getTables(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// รันคำสั่ง SHOW TABLES ดึงรายชื่อตารางทั้งหมด
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			http.Error(w, "Scan error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		tables = append(tables, tableName)
	}

	// ส่งผลลัพธ์กลับเป็น JSON Array
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tables)
}

// handler สำหรับรีเซ็ตรหัสผ่านโดยตรง (ไม่ต้องกรอกรหัสผ่านเดิม)
func resetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UID         int    `json:"uid"`
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.NewPassword == "" {
		http.Error(w, "New password is required", http.StatusBadRequest)
		return
	}

	// 1. เข้ารหัส (Hash) รหัสผ่านใหม่ก่อนบันทึกลง DB
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. อัปเดตรหัสผ่านใหม่ลงตาราง user
	res, err := db.Exec("UPDATE user SET password = ? WHERE uid = ?", string(hashedPassword), req.UID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": fmt.Sprintf("Reset password for UID %d successfully", req.UID),
	})
}
