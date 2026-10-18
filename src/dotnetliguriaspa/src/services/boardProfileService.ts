import { BoardProfileModel } from "../models/BoadProfileModel";
import { API_BASE_URL } from "../config/apiConfig";

export const getBoardProfiles = async (): Promise<BoardProfileModel[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/Board/Get`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const boardProfiles: BoardProfileModel[] = await response.json();
    return boardProfiles;
  } catch (error) {
    console.error("Error fetching board profiles.");
    throw error;
  }
};

export const getActiveBoardProfiles = async (): Promise<
  BoardProfileModel[]
> => {
  try {
    const response = await fetch(`${API_BASE_URL}/Board/Get?onlyActive=true`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const boardProfiles: BoardProfileModel[] = await response.json();
    return boardProfiles;
  } catch (error) {
    console.error("Error fetching active board profiles.");
    throw error;
  }
};
