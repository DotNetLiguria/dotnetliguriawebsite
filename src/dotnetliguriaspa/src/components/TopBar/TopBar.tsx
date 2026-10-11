import React, { FC, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from "react-router-dom";
import LoginControl from '../loginControl';
import './TopBar.css';
import { API_BASE_URL } from '../../config/apiConfig';
import TopMenuElementModel from '../../models/TopMenuElementModel';
import logo from '../../assets/logo/dotnet-liguria-storico.png';
import logo2x from '../../assets/logo/dotnet-liguria-storico-2x.png';

interface TopBarProps {
    pageName?: string;
    showMenu: boolean;
}

interface MenuItem {
    label: string;
    href: string;
}

const TopBar: FC<TopBarProps> = () => {
    const navigate = useNavigate();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    useEffect(() => {
        const loadMenuItems = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/TopMenu`);
                const data: TopMenuElementModel[] = await response.json();

                // Filtra solo elementi attivi e ordina per campo order
                const activeItems = data
                    .filter(item => item.isActive)
                    .sort((a, b) => a.order - b.order)
                    .map(item => ({
                        label: item.name,
                        href: item.url
                    }));

                setMenuItems(activeItems);
            } catch (error) {
                console.error('Error loading menu items:', error);
                // Fallback ai menu items di default in caso di errore
                setMenuItems([
                    { label: 'Home', href: '/' },
                    { label: '.NET Conf 2025', href: '/#evidence' },
                    { label: 'Il Team', href: '/#team' },
                    { label: 'Eventi passati', href: '/workshops' },
                ]);
            }
        };

        loadMenuItems();
    }, []);

    const handleNavigation = (href: string) => {
        if (href === '/') {
            // Se clicchi su Home, vai all'inizio della pagina
            if (window.location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                navigate('/');
            }
        } else if (href.startsWith('/#')) {
            // Se siamo già sulla home, scorri all'ancora
            if (window.location.pathname === '/') {
                const anchor = href.substring(2);
                const element = document.getElementById(anchor);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                // Naviga alla home e poi scorri all'ancora
                navigate('/');
                setTimeout(() => {
                    const anchor = href.substring(2);
                    const element = document.getElementById(anchor);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            }
        }
    };

    return (
        <nav className="main-menu">
            <RouterLink to="/admin" className="main-menu__logo" aria-label="DotNetLiguria, area amministrazione">
                <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} alt="" width={241} height={105} />
            </RouterLink>
            <ul>
                {menuItems.map(item => (
                    <li key={item.href}>
                        {item.href === '/' || item.href.startsWith('/#') ? (
                            <a
                                href={item.href}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleNavigation(item.href);
                                }}
                            >
                                {item.label}
                            </a>
                        ) : (
                            <RouterLink to={item.href}>{item.label}</RouterLink>
                        )}
                    </li>
                ))}
                <li className="login-item">
                    <LoginControl onLogout={() => navigate('/')} />
                </li>
            </ul>
        </nav>
    );
}

export default TopBar;
