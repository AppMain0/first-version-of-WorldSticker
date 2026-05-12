import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { initialAlbum } from "./AlbumData";
import { auth, db } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [album, setAlbum] = useState(initialAlbum);
  const [albumLoaded, setAlbumLoaded] = useState(false);

  const [tab, setTab] = useState("album");
  const [search, setSearch] = useState("");
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await cargarAlbumUsuario(firebaseUser.uid);
      } else {
        setAlbum(initialAlbum);
        setAlbumLoaded(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);


  const registrar = async () => {
    if (!email || !password) {
      Alert.alert("Faltan datos", "Escribe correo y contraseña.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert("Error al registrarse", error.message);
    }
  };

  const iniciarSesion = async () => {
    if (!email || !password) {
      Alert.alert("Faltan datos", "Escribe correo y contraseña.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert("Error al iniciar sesión", error.message);
    }
  };

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const cargarAlbumUsuario = async (uid) => {
    try {
      const ref = doc(db, "usuarios", uid);
      const snap = await getDoc(ref);

      if (snap.exists() && snap.data().album) {
        setAlbum(snap.data().album);
      } else {
        setAlbum(initialAlbum);
        await setDoc(ref, {
          email: auth.currentUser.email,
          album: initialAlbum,
        });
      }

      setAlbumLoaded(true);
    } catch (error) {
      console.log("Error cargando álbum:", error);
    }
  };

  const guardarAlbumUsuario = async () => {
    try {
      const ref = doc(db, "usuarios", user.uid);
      await setDoc(
        ref,
        {
          email: user.email,
          album,
        },
        { merge: true }
      );
    } catch (error) {
      console.log("Error guardando álbum:", error);
    }
  };

  const todasLasFiguritas = album.flatMap((team) =>
    team.stickers.map((sticker) => ({
      ...sticker,
      teamId: team.id,
      teamName: team.name,
      group: team.group,
    }))
  );

  const total = todasLasFiguritas.length;
  const tengo = todasLasFiguritas.filter((s) => s.owned).length;
  const faltantes = todasLasFiguritas.filter((s) => !s.owned);
  const repetidas = todasLasFiguritas.filter((s) => s.duplicates > 0);


const actualizarSticker = async (stickerId, action) => {
  const nuevoAlbum = album.map((team) => ({
    ...team,
    stickers: team.stickers.map((sticker) => {
      if (sticker.id !== stickerId) return sticker;

      if (action === "toggleOwned") {
        return {
          ...sticker,
          owned: !sticker.owned,
        };
      }

      if (action === "addDuplicate") {
        return {
          ...sticker,
          owned: true,
          duplicates: sticker.duplicates + 1,
        };
      }

      if (action === "removeDuplicate") {
        return {
          ...sticker,
          duplicates: Math.max(0, sticker.duplicates - 1),
        };
      }

      return sticker;
    }),
  }));

  setAlbum(nuevoAlbum);

  try {
    if (user) {
      const ref = doc(db, "usuarios", user.uid);

      await setDoc(
        ref,
        {
          email: user.email,
          album: nuevoAlbum,
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.log("Error guardando álbum:", error);
  }
};

  const buscarPorCodigo = (codigo) => {
    const limpio = String(codigo).trim().toUpperCase().replace(/\s/g, "");

    return todasLasFiguritas.find((s) => {
      const code = s.code.toUpperCase().replace(/\s/g, "");
      const id = s.id.toUpperCase().replace(/\s/g, "");
      return code === limpio || id === limpio;
    });
  };

  const agregarPorCodigo = (codigo) => {
    if (!String(codigo).trim()) {
      Alert.alert("Código vacío", "Ingresa o escanea un código.");
      return;
    }

    const sticker = buscarPorCodigo(codigo);

    if (!sticker) {
      Alert.alert("No encontrada", "Ese código no existe en el álbum.");
      return;
    }

    if (sticker.owned) {
      actualizarSticker(sticker.id, "addDuplicate");
      Alert.alert("Repetida", `${sticker.code} - ${sticker.name} ya la tienes.`);
    } else {
      actualizarSticker(sticker.id, "toggleOwned");
      Alert.alert("Agregada", `${sticker.code} - ${sticker.name} se agregó.`);
    }

    setSearch("");
  };

  const handleScan = ({ data }) => {
    if (scanned) return;

    setScanned(true);
    agregarPorCodigo(data);

    setTimeout(() => {
      setScanned(false);
    }, 1800);
  };

  const filtrar = (lista) => {
    if (!search.trim()) return lista;

    const texto = search.toLowerCase();

    return lista.filter(
      (s) =>
        s.code.toLowerCase().includes(texto) ||
        s.name?.toLowerCase().includes(texto) ||
        s.teamName.toLowerCase().includes(texto) ||
        s.group.toLowerCase().includes(texto)
    );
  };

  const dataActual =
    tab === "faltantes"
      ? filtrar(faltantes)
      : tab === "repetidas"
      ? filtrar(repetidas)
      : filtrar(todasLasFiguritas);

  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <Text style={styles.title}>WorldSticker</Text>

        <TextInput
          style={styles.inputLogin}
          placeholder="Correo"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.inputLogin}
          placeholder="Contraseña"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.loginButton} onPress={iniciarSesion}>
          <Text style={styles.btnText}>Iniciar sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerButton} onPress={registrar}>
          <Text style={styles.btnText}>Registrarme</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderSticker = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.code}>{item.code}</Text>
        <Text style={styles.playerName}>{item.name || item.code}</Text>
        <Text style={styles.team}>{item.teamName}</Text>
        <Text style={styles.group}>{item.group}</Text>

        <Text style={item.owned ? styles.estadoTengo : styles.estadoFalta}>
          {item.owned ? "La tengo" : "Me falta"}
        </Text>

        {item.duplicates > 0 && (
          <Text style={styles.repetida}>Repetidas: {item.duplicates}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={item.owned ? styles.btnQuitar : styles.btnAgregar}
          onPress={() => actualizarSticker(item.id, "toggleOwned")}
        >
          <Text style={styles.btnText}>{item.owned ? "Quitar" : "Tengo"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnRepetida}
          onPress={() => actualizarSticker(item.id, "addDuplicate")}
        >
          <Text style={styles.btnText}>+ Rep</Text>
        </TouchableOpacity>

        {item.duplicates > 0 && (
          <TouchableOpacity
            style={styles.btnMenos}
            onPress={() => actualizarSticker(item.id, "removeDuplicate")}
          >
            <Text style={styles.btnText}>- Rep</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Álbum Mundial 2026</Text>
      <Text style={styles.userText}>{user.email}</Text>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>Total: {total}</Text>
        <Text style={styles.summaryText}>Tengo: {tengo}</Text>
        <Text style={styles.summaryText}>Faltantes: {faltantes.length}</Text>
        <Text style={styles.summaryText}>Repetidas: {repetidas.length}</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Ej: MEX 1 o Luis Malagón"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.btnBuscar}
          onPress={() => agregarPorCodigo(search)}
        >
          <Text style={styles.btnText}>Agregar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {["album", "faltantes", "repetidas", "camara"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}>
            <Text style={tab === t ? styles.tabActive : styles.tab}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "camara" ? (
        <View style={styles.cameraContainer}>
          <View style={styles.cameraBox}>
            {permission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
                }}
                onBarcodeScanned={scanned ? undefined : handleScan}
              />
            ) : (
              <View style={styles.permissionBox}>
                <Text style={styles.empty}>La cámara no tiene permiso.</Text>
                <TouchableOpacity style={styles.btnBuscar} onPress={requestPermission}>
                  <Text style={styles.btnText}>Dar permiso</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.cameraHelp}>Escanea el código de la figurita.</Text>
        </View>
      ) : (
        <FlatList
          data={dataActual}
          keyExtractor={(item) => item.id}
          renderItem={renderSticker}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={cerrarSesion}>
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  container: {
    flex: 1,
    paddingTop: 55,
    paddingHorizontal: 16,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#fff",
  },
  userText: {
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 10,
  },
  inputLogin: {
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  loginButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  registerButton: {
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 10,
  },
  summary: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  summaryText: {
    color: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
  },
  btnBuscar: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    backgroundColor: "#1f2937",
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#2563eb",
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  cardInfo: {
    flex: 1,
  },
  code: {
    fontWeight: "bold",
    fontSize: 17,
    color: "#fff",
  },
  playerName: {
    color: "#fff",
    fontSize: 15,
    marginTop: 2,
    fontWeight: "600",
  },
  team: {
    color: "#e5e7eb",
    marginTop: 2,
  },
  group: {
    color: "#9ca3af",
    fontSize: 12,
  },
  estadoTengo: {
    color: "#22c55e",
    marginTop: 4,
    fontWeight: "bold",
  },
  estadoFalta: {
    color: "#ef4444",
    marginTop: 4,
    fontWeight: "bold",
  },
  repetida: {
    marginTop: 4,
    color: "#60a5fa",
    fontWeight: "bold",
  },
  actions: {
    gap: 6,
    justifyContent: "center",
  },
  btnAgregar: {
    backgroundColor: "#16a34a",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnQuitar: {
    backgroundColor: "#dc2626",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnRepetida: {
    backgroundColor: "#2563eb",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnMenos: {
    backgroundColor: "#f97316",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  cameraContainer: {
    flex: 1,
  },
  cameraBox: {
    height: 500,
    overflow: "hidden",
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: "#000",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  cameraHelp: {
    color: "#9ca3af",
    textAlign: "center",
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    marginTop: 30,
    color: "#9ca3af",
  },
  logoutButton: {
    backgroundColor: "#374151",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
});