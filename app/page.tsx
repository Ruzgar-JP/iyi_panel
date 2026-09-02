import { redirect } from "next/navigation";

/** Alan adı doğrudan açıldığında her zaman müşteri girişi gösterilir. */
export default function AnaSayfa() {
  redirect("/panel/giris");
}
