import { createTheme } from "@mui/material";

// Admin theme with the public site's tokens (src/site/site.css): navy text and main actions,
// cyan for links and focus, basil green for success. The admin keeps MUI until its redesign.
const theme = createTheme({
    palette: {
        primary: { main: "#083d73", dark: "#002445", light: "#2f5f93", contrastText: "#ffffff" },
        secondary: { main: "#007ba6", dark: "#005f80", light: "#8fd3ec", contrastText: "#ffffff" },
        success: { main: "#3b7a20", dark: "#2c5c18", light: "#59a52c", contrastText: "#ffffff" },
        info: { main: "#007ba6", contrastText: "#ffffff" },
        warning: { main: "#b54708", contrastText: "#ffffff" },
        error: { main: "#b42318", contrastText: "#ffffff" },
        text: { primary: "#083d73", secondary: "#44607a" },
        divider: "#d5e3ec",
        background: { default: "#f5f9fc", paper: "#ffffff" },
    },
    typography: {
        fontFamily: '"Titillium Web", Arial, sans-serif',
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        h3: { fontWeight: 700 },
        h4: { fontWeight: 700 },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 700 },
        button: { textTransform: "none", fontWeight: 700 },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { borderRadius: 999 } },
        },
        MuiButtonBase: {
            styleOverrides: { root: { "&.Mui-focusVisible": { outline: "3px solid #007ba6", outlineOffset: 2 } } },
        },
        MuiLink: { defaultProps: { color: "secondary" } },
        MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
});

export default theme;
