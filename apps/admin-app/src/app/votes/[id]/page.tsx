import ClientPage from "./vote-detail";

export function generateStaticParams() {
  return [{ id: "__placeholder" }];
}

export default function Page() {
  return <ClientPage />;
}
