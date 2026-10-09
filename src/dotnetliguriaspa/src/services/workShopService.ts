import { WorkshopModel } from "../models/WorkshopModel";
import { API_BASE_URL } from "../config/apiConfig";

export const getWorkshops = async (): Promise<WorkshopModel[]> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/Workshop/Get?onlyPublished=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const boardProfiles: WorkshopModel[] = await response.json();
    return boardProfiles;
  } catch (error) {
    console.error("Error fetching user profiles:", error);
    throw error;
  }
};

export const getWorkshopById = async (id: string): Promise<WorkshopModel> => {
  try {
    const response = await fetch(`${API_BASE_URL}/Workshop/Get/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Workshop with ID ${id} not found`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const workshop: WorkshopModel = await response.json();
    return workshop;
  } catch (error) {
    console.error("Error fetching workshop:", error);
    throw error;
  }
};

export const getWorkshopsByYear = async (
  year: number
): Promise<WorkshopModel[]> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/Workshop/GetByYear/${year}?onlyPublished=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const workshops: WorkshopModel[] = await response.json();
    return workshops;
  } catch (error) {
    console.error("Error fetching workshops by year:", error);
    throw error;
  }
};
